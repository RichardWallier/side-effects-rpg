-- Operações que precisam de várias tabelas consistentes entre si. Vivem no banco
-- (uma transação) e são chamadas pelos Route Handlers com a service_role key.
-- `authenticated` não recebe EXECUTE em nenhuma delas.

-- Como um membro é rotulado no chat: mestre é "Mestre", jogador é o nome do
-- personagem, com o display_name do perfil como último recurso.
create or replace function public.member_label(p_campaign_id uuid, p_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when (select m.role from public.campaign_members m
          where m.campaign_id = p_campaign_id and m.user_id = p_user_id) = 'mestre'
      then 'Mestre'
    else coalesce(
      (select c.name from public.characters c
       where c.campaign_id = p_campaign_id and c.owner_user_id = p_user_id),
      (select nullif(p.display_name, '') from public.profiles p where p.user_id = p_user_id),
      'Agente'
    )
  end;
$$;

-- Garante o tecido de canais do protótipo: uma sala de grupo com todo mundo e
-- uma DM pra cada par de membros. Idempotente — roda de novo a cada entrada.
create or replace function public.ensure_campaign_channels(p_campaign_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
  v_ch    uuid;
  rec     record;
  a_first boolean;
begin
  select id into v_group
  from public.chat_channels
  where campaign_id = p_campaign_id and type = 'group';

  if v_group is null then
    insert into public.chat_channels (campaign_id, type, name)
    values (p_campaign_id, 'group', 'Sala do Grupo')
    returning id into v_group;
  end if;

  insert into public.chat_participants (channel_id, user_id)
  select v_group, m.user_id
  from public.campaign_members m
  where m.campaign_id = p_campaign_id
  on conflict do nothing;

  for rec in
    select m1.user_id as ua, m1.role as ra, m2.user_id as ub, m2.role as rb
    from public.campaign_members m1
    join public.campaign_members m2
      on m2.campaign_id = m1.campaign_id and m2.user_id > m1.user_id
    where m1.campaign_id = p_campaign_id
  loop
    select ch.id into v_ch
    from public.chat_channels ch
    where ch.campaign_id = p_campaign_id
      and ch.type = 'dm'
      and exists (select 1 from public.chat_participants p
                  where p.channel_id = ch.id and p.user_id = rec.ua)
      and exists (select 1 from public.chat_participants p
                  where p.channel_id = ch.id and p.user_id = rec.ub)
    limit 1;

    if v_ch is null then
      a_first := (rec.rb <> 'mestre');  -- mestre sempre nomeado primeiro
      insert into public.chat_channels (campaign_id, type, name)
      values (
        p_campaign_id,
        'dm',
        case when a_first
          then public.member_label(p_campaign_id, rec.ua) || ' ↔ ' || public.member_label(p_campaign_id, rec.ub)
          else public.member_label(p_campaign_id, rec.ub) || ' ↔ ' || public.member_label(p_campaign_id, rec.ua)
        end
      )
      returning id into v_ch;

      insert into public.chat_participants (channel_id, user_id)
      values (v_ch, rec.ua), (v_ch, rec.ub);
    end if;
  end loop;
end;
$$;

create or replace function public.default_skills()
returns jsonb language sql immutable as $$
  select '{
    "Pontaria":0,"Combate Corpo-a-Corpo":0,"Condução/Perseguição":0,"Resistência":0,
    "Perícia Forense":0,"Investigação":0,"Tecnologia":0,"Rastreamento":0,
    "Persuasão":0,"Manipulação":0,"Rede de Contatos":0,"Primeiros Socorros":0
  }'::jsonb;
$$;

create or replace function public.create_campaign(
  p_name       text,
  p_gm_user_id uuid,
  p_synopsis   text default ''
)
returns public.campaigns
language plpgsql security definer set search_path = public as $$
declare
  v_campaign public.campaigns;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'check_violation';
  end if;

  insert into public.campaigns (name, gm_user_id, synopsis)
  values (trim(p_name), p_gm_user_id, coalesce(p_synopsis, ''))
  returning * into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, p_gm_user_id, 'mestre');

  perform public.ensure_campaign_channels(v_campaign.id);

  return v_campaign;
end;
$$;

-- Redenção de convite: valida o código, cria membership + personagem + canais
-- numa transação só. Idempotente pra quem já é membro.
create or replace function public.redeem_invite(
  p_invite_code    text,
  p_user_id        uuid,
  p_character_name text,
  p_archetype      public.archetype,
  p_occupation     text default ''
)
returns public.campaigns
language plpgsql security definer set search_path = public as $$
declare
  v_campaign  public.campaigns;
  v_member    public.campaign_members;
  v_character public.characters;
begin
  select * into v_campaign
  from public.campaigns
  where invite_code = upper(trim(p_invite_code));

  if v_campaign.id is null then
    raise exception 'INVITE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select * into v_member
  from public.campaign_members
  where campaign_id = v_campaign.id and user_id = p_user_id;

  if v_member.id is not null then
    perform public.ensure_campaign_channels(v_campaign.id);
    return v_campaign;
  end if;

  if coalesce(trim(p_character_name), '') = '' then
    raise exception 'CHARACTER_NAME_REQUIRED' using errcode = 'check_violation';
  end if;

  insert into public.characters (campaign_id, owner_user_id, name, occupation, archetype, skills)
  values (v_campaign.id, p_user_id, trim(p_character_name), coalesce(p_occupation, ''),
          p_archetype, public.default_skills())
  returning * into v_character;

  insert into public.campaign_members (campaign_id, user_id, role, character_id)
  values (v_campaign.id, p_user_id, 'player', v_character.id);

  perform public.ensure_campaign_channels(v_campaign.id);

  return v_campaign;
end;
$$;

-- Narração do mestre: só o mestre da campanha daquele canal de grupo.
create or replace function public.broadcast_narration(
  p_campaign_id uuid,
  p_gm_user_id  uuid,
  p_text        text
)
returns public.chat_messages
language plpgsql security definer set search_path = public as $$
declare
  v_group   uuid;
  v_message public.chat_messages;
begin
  if not exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign_id and user_id = p_gm_user_id and role = 'mestre'
  ) then
    raise exception 'NOT_GM' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(p_text), '') = '' then
    raise exception 'TEXT_REQUIRED' using errcode = 'check_violation';
  end if;

  select id into v_group
  from public.chat_channels
  where campaign_id = p_campaign_id and type = 'group';

  insert into public.chat_messages (channel_id, sender_id, type, body)
  values (v_group, p_gm_user_id, 'narration', jsonb_build_object('text', trim(p_text)))
  returning * into v_message;

  return v_message;
end;
$$;

revoke execute on function
  public.member_label(uuid, uuid),
  public.ensure_campaign_channels(uuid),
  public.create_campaign(text, uuid, text),
  public.redeem_invite(text, uuid, text, public.archetype, text),
  public.broadcast_narration(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
  public.create_campaign(text, uuid, text),
  public.redeem_invite(text, uuid, text, public.archetype, text),
  public.broadcast_narration(uuid, uuid, text)
to service_role;
