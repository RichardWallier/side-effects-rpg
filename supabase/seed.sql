-- Seed equivalente ao protótipo: 1 mestre + 5 jogadores, campanha "Caso #2019-114",
-- fichas, compartilhamentos, mensagens semente e o mural de evidências.
--
-- Roda automaticamente em `supabase db reset` (local). Pra aplicar num projeto
-- hospedado, cole no SQL Editor DEPOIS das migrations.
--
-- Senha de todos os usuários: efeitos123

create or replace function public.seed_create_user(
  p_email text, p_display_name text, p_password text
) returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    p_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_display_name),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  return uid;
end;
$$;

-- Acha a DM de um par de usuários numa campanha.
create or replace function public.seed_dm(p_campaign uuid, p_a uuid, p_b uuid)
returns uuid language sql stable as $$
  select ch.id
  from public.chat_channels ch
  where ch.campaign_id = p_campaign and ch.type = 'dm'
    and exists (select 1 from public.chat_participants p where p.channel_id = ch.id and p.user_id = p_a)
    and exists (select 1 from public.chat_participants p where p.channel_id = ch.id and p.user_id = p_b)
  limit 1;
$$;

do $$
declare
  pass     text := 'efeitos123';
  u_mestre uuid; u_camila uuid; u_bruno uuid; u_rafael uuid; u_marina uuid; u_diego uuid;
  camp     uuid;
  c_camila uuid; c_bruno uuid; c_rafael uuid; c_marina uuid; c_diego uuid;
  ch_group uuid; ch_cam_mar uuid; ch_mes_bru uuid;
  e1 uuid; e2 uuid; e3 uuid;
begin
  u_mestre := public.seed_create_user('mestre@efeitos.local', 'Mestre',         pass);
  u_camila := public.seed_create_user('camila@efeitos.local', 'Camila Duarte',  pass);
  u_bruno  := public.seed_create_user('bruno@efeitos.local',  'Bruno Alves',    pass);
  u_rafael := public.seed_create_user('rafael@efeitos.local', 'Rafael Nunes',   pass);
  u_marina := public.seed_create_user('marina@efeitos.local', 'Marina Costa',   pass);
  u_diego  := public.seed_create_user('diego@efeitos.local',  'Diego Ferreira', pass);

  camp := (public.create_campaign('Caso #2019-114', u_mestre)).id;

  update public.campaigns set
    invite_code = 'EFC114',
    act = 1,
    synopsis = 'O grupo ainda está espalhado. Bruno e Diego investigam denúncias de um cultivo '
             || 'clandestino de cogumelos numa zona industrial. Camila e Marina cumprem suas funções '
             || 'normais na farmacêutica, sem saber que a empresa é o verdadeiro alvo. Rafael analisa '
             || 'laudos que não batem com o relatório oficial.',
    session_notes = 'Sessão 3: grupo policial encontrou o laboratório improvisado. O "traficante" '
             || '(Dr. Anselmo) não reagiu com violência — só pediu para não destruírem as amostras. '
             || 'Ninguém confia nele ainda.'
  where id = camp;

  insert into public.characters
    (campaign_id, owner_user_id, name, occupation, archetype, attrs, skills,
     karma, pool_max, pool_spent, wound, hook, equip)
  values
    (camp, u_camila, 'Camila Duarte', 'Assistente Executiva', 'Soft',
     '{"Físico":2,"Reflexo":3,"Intelecto":3,"Percepção":4,"Empatia":5,"Influência":4}',
     public.default_skills() || '{"Persuasão":4,"Rede de Contatos":2,"Primeiros Socorros":2}'::jsonb,
     1, 3, 1, 0,
     'Cuida de documentos importantes da empresa — tem acesso a arquivos que poucos veem, e começa a desconfiar do que está guardando.',
     'Crachá da empresa · celular corporativo · caderno de anotações')
  returning id into c_camila;

  insert into public.characters
    (campaign_id, owner_user_id, name, occupation, archetype, attrs, skills,
     karma, pool_max, pool_spent, wound, hook, equip)
  values
    (camp, u_bruno, 'Bruno Alves', 'Investigador de Polícia', 'Hard',
     '{"Físico":5,"Reflexo":4,"Intelecto":2,"Percepção":4,"Empatia":2,"Influência":3}',
     public.default_skills() || '{"Pontaria":4,"Combate Corpo-a-Corpo":2,"Resistência":2}'::jsonb,
     -1, 3, 0, 0,
     'Policial cético, acostumado a ver o "cultivo clandestino" como caso simples. Vai ter que engolir o orgulho quando a farmacêutica aparecer no meio.',
     'Arma de serviço · distintivo · rádio')
  returning id into c_bruno;

  insert into public.characters
    (campaign_id, owner_user_id, name, occupation, archetype, attrs, skills,
     karma, pool_max, pool_spent, wound, hook, equip)
  values
    (camp, u_rafael, 'Rafael Nunes', 'Perito Criminal', 'Intel',
     '{"Físico":2,"Reflexo":3,"Intelecto":5,"Percepção":5,"Empatia":3,"Influência":2}',
     public.default_skills() || '{"Perícia Forense":4,"Investigação":2,"Tecnologia":2}'::jsonb,
     0, 3, 0, 0,
     'Encontra inconsistências nos laudos oficiais que não fecham com o que a farmacêutica reporta às autoridades.',
     'Kit forense · notebook · câmera')
  returning id into c_rafael;

  insert into public.characters
    (campaign_id, owner_user_id, name, occupation, archetype, attrs, skills,
     karma, pool_max, pool_spent, wound, hook, equip)
  values
    (camp, u_marina, 'Marina Costa', 'Gerente de RH (Farmacêutica)', 'Soft',
     '{"Físico":2,"Reflexo":2,"Intelecto":4,"Percepção":3,"Empatia":4,"Influência":5}',
     public.default_skills() || '{"Rede de Contatos":4,"Persuasão":2,"Manipulação":2}'::jsonb,
     -1, 3, 2, 0,
     'Assinou NDAs que agora parecem esconder muito mais que segredo industrial. Conhece todo mundo na empresa — inclusive quem manda de verdade.',
     'Crachá de acesso nível 3 · agenda corporativa')
  returning id into c_marina;

  insert into public.characters
    (campaign_id, owner_user_id, name, occupation, archetype, attrs, skills,
     karma, pool_max, pool_spent, wound, hook, equip)
  values
    (camp, u_diego, 'Diego Ferreira', 'Policial (novato)', 'Hard',
     '{"Físico":4,"Reflexo":5,"Intelecto":2,"Percepção":3,"Empatia":3,"Influência":3}',
     public.default_skills() || '{"Condução/Perseguição":4,"Pontaria":2,"Resistência":2}'::jsonb,
     0, 3, 1, 1,
     'Parceiro de Bruno, ainda idealista sobre o trabalho. A primeira ferida vai doer mais no ego do que no corpo.',
     'Arma de serviço · viatura · rádio')
  returning id into c_diego;

  insert into public.campaign_members (campaign_id, user_id, role, character_id) values
    (camp, u_camila, 'player', c_camila),
    (camp, u_bruno,  'player', c_bruno),
    (camp, u_rafael, 'player', c_rafael),
    (camp, u_marina, 'player', c_marina),
    (camp, u_diego,  'player', c_diego);

  perform public.ensure_campaign_channels(camp);

  -- compartilhamentos do protótipo (o mestre não precisa de linha: RLS já o cobre)
  insert into public.character_shares (character_id, shared_with_user_id) values
    (c_camila, u_marina),
    (c_bruno,  u_diego),
    (c_marina, u_camila),
    (c_diego,  u_bruno);

  select id into ch_group from public.chat_channels where campaign_id = camp and type = 'group';
  ch_cam_mar := public.seed_dm(camp, u_camila, u_marina);
  ch_mes_bru := public.seed_dm(camp, u_mestre, u_bruno);

  insert into public.chat_messages (channel_id, sender_id, type, body, created_at) values
    (ch_group, u_bruno, 'text',
     '{"text":"Alguém mais achou estranho a empresa mandar advogado pro local antes da perícia terminar?"}',
     now() - interval '2 hours'),
    (ch_group, u_rafael, 'text',
     '{"text":"Achei. E não foi advogado qualquer, era do jurídico corporativo. Rápido demais."}',
     now() - interval '1 hour 58 minutes'),
    (ch_cam_mar, u_marina, 'text',
     '{"text":"Você viu os arquivos que te passei? Não fala sobre isso no corredor."}',
     now() - interval '2 hours 31 minutes'),
    (ch_cam_mar, u_camila, 'text',
     '{"text":"Vi. Isso não é sobre cogumelo nenhum, Marina."}',
     now() - interval '2 hours 25 minutes'),
    (ch_mes_bru, u_mestre, 'text',
     '{"text":"[nota do mestre] Bruno, faça um teste de Percepção quando quiser — tem algo no laboratório que ainda não foi mencionado pro grupo."}',
     now() - interval '1 hour 52 minutes');

  insert into public.evidence_cards (campaign_id, title, text, x, y) values
    (camp, 'Dr. Anselmo',
     '"Traficante" — na verdade pesquisador. Não reagiu com violência na batida.', 60, 70)
  returning id into e1;

  insert into public.evidence_cards (campaign_id, title, text, x, y) values
    (camp, 'Advogado corporativo',
     'Chegou rápido demais no local. Jurídico da farmacêutica, não advogado autônomo.', 340, 120)
  returning id into e2;

  insert into public.evidence_cards (campaign_id, title, text, x, y) values
    (camp, 'Laudo inconsistente',
     'Perícia oficial não bate com o que a empresa reportou às autoridades.', 220, 340)
  returning id into e3;

  insert into public.evidence_links (campaign_id, card_a_id, card_b_id) values
    (camp, e1, e2),
    (camp, e2, e3);
end;
$$;

drop function public.seed_create_user(text, text, text);
drop function public.seed_dm(uuid, uuid, uuid);
