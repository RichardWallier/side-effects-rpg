-- Efeitos Colaterais — RLS (seção 5 do briefing).
--
-- Toda checagem de "pertence à campanha / participa do canal" passa por funções
-- SECURITY DEFINER. Isso não é cosmético: uma policy em campaign_members que
-- consultasse campaign_members (ou uma em characters que consultasse
-- character_shares, cuja policy consulta characters) recursaria infinitamente,
-- porque a subquery reaplica a RLS da tabela alvo. As funções rodam como owner,
-- ignoram RLS e cortam o ciclo.

-- ---------------------------------------------------------------- helpers
create or replace function public.is_campaign_member(p_campaign_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_campaign_gm(p_campaign_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id
      and m.user_id = auth.uid()
      and m.role = 'mestre'
  );
$$;

create or replace function public.shares_campaign_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.campaign_members mine
    join public.campaign_members theirs on theirs.campaign_id = mine.campaign_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;

create or replace function public.character_owner(p_character_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select c.owner_user_id from public.characters c where c.id = p_character_id;
$$;

create or replace function public.character_campaign(p_character_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select c.campaign_id from public.characters c where c.id = p_character_id;
$$;

create or replace function public.is_character_shared_with_me(p_character_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.character_shares s
    where s.character_id = p_character_id and s.shared_with_user_id = auth.uid()
  );
$$;

create or replace function public.channel_campaign(p_channel_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select ch.campaign_id from public.chat_channels ch where ch.id = p_channel_id;
$$;

create or replace function public.is_channel_participant(p_channel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_participants p
    where p.channel_id = p_channel_id and p.user_id = auth.uid()
  );
$$;

revoke execute on function
  public.is_campaign_member(uuid),
  public.is_campaign_gm(uuid),
  public.shares_campaign_with(uuid),
  public.character_owner(uuid),
  public.character_campaign(uuid),
  public.is_character_shared_with_me(uuid),
  public.channel_campaign(uuid),
  public.is_channel_participant(uuid)
from public, anon;

grant execute on function
  public.is_campaign_member(uuid),
  public.is_campaign_gm(uuid),
  public.shares_campaign_with(uuid),
  public.character_owner(uuid),
  public.character_campaign(uuid),
  public.is_character_shared_with_me(uuid),
  public.channel_campaign(uuid),
  public.is_channel_participant(uuid)
to authenticated;

-- ---------------------------------------------------------------- liga a RLS
alter table public.profiles          enable row level security;
alter table public.campaigns         enable row level security;
alter table public.campaign_members  enable row level security;
alter table public.characters        enable row level security;
alter table public.character_shares  enable row level security;
alter table public.chat_channels     enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.evidence_cards    enable row level security;
alter table public.evidence_links    enable row level security;
alter table public.read_pointers     enable row level security;

-- anon nunca fala com essas tabelas; service_role ignora RLS por padrão.
revoke all on public.profiles, public.campaigns, public.campaign_members,
              public.characters, public.character_shares, public.chat_channels,
              public.chat_participants, public.chat_messages, public.evidence_cards,
              public.evidence_links, public.read_pointers
from anon;

-- ---------------------------------------------------------------- profiles
grant select, update on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.shares_campaign_with(user_id));

create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- campaigns
-- INSERT/DELETE só via Route Handler com service_role (criar campanha precisa
-- criar membership + canal de grupo na mesma transação lógica).
grant select, update on public.campaigns to authenticated;

create policy campaigns_select_member on public.campaigns for select to authenticated
  using (public.is_campaign_member(id));

create policy campaigns_update_gm on public.campaigns for update to authenticated
  using (public.is_campaign_gm(id)) with check (public.is_campaign_gm(id));

-- ---------------------------------------------------------------- membership
-- INSERT deliberadamente ausente: redenção de convite é server-side, senão dá
-- pra forçar bruta em invite_code direto do client.
grant select on public.campaign_members to authenticated;

create policy campaign_members_select on public.campaign_members for select to authenticated
  using (public.is_campaign_member(campaign_id));

-- ---------------------------------------------------------------- characters
grant select, update on public.characters to authenticated;

create policy characters_select on public.characters for select to authenticated
  using (
    owner_user_id = auth.uid()
    or public.is_campaign_gm(campaign_id)
    or public.is_character_shared_with_me(id)
  );

create policy characters_update on public.characters for update to authenticated
  using (owner_user_id = auth.uid() or public.is_campaign_gm(campaign_id))
  with check (owner_user_id = auth.uid() or public.is_campaign_gm(campaign_id));

-- Nomes/arquétipos de TODOS os personagens da campanha, sem vazar a ficha:
-- o Explorer precisa disso pra desenhar as pastas trancadas e o chat precisa
-- pra rotular DMs. security_invoker off = a view roda como owner e ignora a RLS
-- de characters; o filtro de acesso é o WHERE abaixo.
create view public.character_directory
with (security_invoker = off) as
  select c.id, c.campaign_id, c.owner_user_id, c.name, c.archetype
  from public.characters c
  where public.is_campaign_member(c.campaign_id);

revoke all on public.character_directory from anon, public;
grant select on public.character_directory to authenticated;

-- ---------------------------------------------------------------- shares
-- Aqui o client escreve direto: o dono decide com quem compartilha a própria ficha.
grant select, insert, delete on public.character_shares to authenticated;

create policy character_shares_select on public.character_shares for select to authenticated
  using (
    shared_with_user_id = auth.uid()
    or public.character_owner(character_id) = auth.uid()
    or public.is_campaign_gm(public.character_campaign(character_id))
  );

create policy character_shares_insert_owner on public.character_shares for insert to authenticated
  with check (
    public.character_owner(character_id) = auth.uid()
    and public.is_campaign_member(public.character_campaign(character_id))
    -- compartilhar só com quem está na mesma campanha
    and exists (
      select 1 from public.campaign_members m
      where m.campaign_id = public.character_campaign(character_id)
        and m.user_id = character_shares.shared_with_user_id
    )
  );

create policy character_shares_delete_owner on public.character_shares for delete to authenticated
  using (public.character_owner(character_id) = auth.uid());

-- ---------------------------------------------------------------- chat
grant select on public.chat_channels, public.chat_participants to authenticated;
grant select, insert on public.chat_messages to authenticated;

create policy chat_channels_select on public.chat_channels for select to authenticated
  using (public.is_channel_participant(id) or public.is_campaign_gm(campaign_id));

create policy chat_participants_select on public.chat_participants for select to authenticated
  using (
    public.is_channel_participant(channel_id)
    or public.is_campaign_gm(public.channel_campaign(channel_id))
  );

-- SELECT cobre a "interceptação": mestre lê DM alheia.
create policy chat_messages_select on public.chat_messages for select to authenticated
  using (
    public.is_channel_participant(channel_id)
    or public.is_campaign_gm(public.channel_campaign(channel_id))
  );

-- INSERT exige participação — é isso, sozinho, que impede o mestre de escrever
-- numa DM jogador↔jogador. O extra é só pra ninguém forjar uma narração.
create policy chat_messages_insert on public.chat_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_channel_participant(channel_id)
    and (
      type <> 'narration'
      or public.is_campaign_gm(public.channel_campaign(channel_id))
    )
  );

-- ---------------------------------------------------------------- evidências
grant select, insert, update, delete on public.evidence_cards, public.evidence_links to authenticated;

create policy evidence_cards_select on public.evidence_cards for select to authenticated
  using (public.is_campaign_member(campaign_id));

create policy evidence_cards_write on public.evidence_cards for all to authenticated
  using (public.is_campaign_gm(campaign_id))
  with check (public.is_campaign_gm(campaign_id));

create policy evidence_links_select on public.evidence_links for select to authenticated
  using (public.is_campaign_member(campaign_id));

create policy evidence_links_write on public.evidence_links for all to authenticated
  using (public.is_campaign_gm(campaign_id))
  with check (public.is_campaign_gm(campaign_id));

-- ---------------------------------------------------------------- read pointers
grant select, insert, update, delete on public.read_pointers to authenticated;

-- O mestre não participa das DMs que intercepta, mas marca elas como lidas.
create policy read_pointers_own on public.read_pointers for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      public.is_channel_participant(channel_id)
      or public.is_campaign_gm(public.channel_campaign(channel_id))
    )
  );
