-- Teste das políticas de RLS (seção 5 do briefing), em SQL puro.
--
-- Complementa scripts/rls-check.ts: aquele exercita o app de verdade
-- (PostgREST + Supabase Auth + anon key) e precisa de um projeto no ar; este roda
-- contra qualquer Postgres com as migrations + o seed aplicados, e testa as
-- policies diretamente — impersonando usuário via `set role authenticated` +
-- `request.jwt.claim.sub`, que é de onde auth.uid() lê.
--
--   psql -f supabase/tests/rls_test.sql -d <banco>
--
-- Sai com erro se qualquer asserção falhar. Não altera dados (roda em transação
-- e dá rollback no fim).

\set ON_ERROR_STOP on
\pset border 2

begin;

grant usage on schema public to anon, authenticated;

create temp table res(nome text, esperado text, obtido text);

-- Roda `p_sql` (que deve devolver um escalar) como se fosse p_uid autenticado.
create or replace function pg_temp.as_user(p_uid uuid, p_sql text) returns text
language plpgsql as $fn$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  set local role authenticated;
  execute p_sql into r;
  reset role;
  return coalesce(r, '0');
exception when others then
  reset role;
  return 'ERRO:' || sqlstate;
end $fn$;

-- Idem, pra escrita: devolve 'linhas:N' ou 'ERRO:<sqlstate>'. A distinção
-- importa — RLS bloqueia UPDATE devolvendo 0 linhas (USING não casa) e bloqueia
-- INSERT levantando 42501 (WITH CHECK falhou).
create or replace function pg_temp.as_user_write(p_uid uuid, p_sql text) returns text
language plpgsql as $fn$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  set local role authenticated;
  execute p_sql;
  get diagnostics n = row_count;
  reset role;
  return 'linhas:' || n;
exception when others then
  reset role;
  return 'ERRO:' || sqlstate;
end $fn$;

-- Sem sessão: roda como o papel `anon`, que é o que o REST usa antes do login.
-- Aqui não é RLS que barra, é a ausência de GRANT — daí o papel separado.
create or replace function pg_temp.as_anon(p_sql text) returns text
language plpgsql as $fn$
declare r text;
begin
  set local role anon;
  execute p_sql into r;
  reset role;
  return coalesce(r, '0');
exception when others then
  reset role;
  return 'ERRO:' || sqlstate;
end $fn$;

create or replace function pg_temp.expect(p_nome text, p_esperado text, p_obtido text)
returns void language sql as $fn$
  insert into res values (p_nome, p_esperado, p_obtido);
$fn$;

do $$
declare
  u_mestre uuid := (select id from auth.users where email = 'mestre@efeitos.local');
  u_camila uuid := (select id from auth.users where email = 'camila@efeitos.local');
  u_bruno  uuid := (select id from auth.users where email = 'bruno@efeitos.local');
  u_rafael uuid := (select id from auth.users where email = 'rafael@efeitos.local');
  u_marina uuid := (select id from auth.users where email = 'marina@efeitos.local');
  c_camila uuid := (select id from characters where name = 'Camila Duarte');
  c_marina uuid := (select id from characters where name = 'Marina Costa');
  c_rafael uuid := (select id from characters where name = 'Rafael Nunes');
  camp     uuid := (select id from campaigns limit 1);
  dm_cm    uuid;  -- DM camila <-> marina
  grupo    uuid := (select id from chat_channels where type = 'group');
begin
  select ch.id into dm_cm from chat_channels ch
  where ch.type = 'dm'
    and exists (select 1 from chat_participants p where p.channel_id=ch.id and p.user_id=u_camila)
    and exists (select 1 from chat_participants p where p.channel_id=ch.id and p.user_id=u_marina);

  -- ---------------------------------------------------------- characters SELECT
  perform pg_temp.expect('mestre vê as 5 fichas', '5',
    pg_temp.as_user(u_mestre, 'select count(*) from characters'));

  perform pg_temp.expect('camila vê 2 fichas (própria + compartilhada por marina)', '2',
    pg_temp.as_user(u_camila, 'select count(*) from characters'));

  perform pg_temp.expect('camila vê a própria ficha', '1',
    pg_temp.as_user(u_camila, format('select count(*) from characters where id=%L', c_camila)));

  perform pg_temp.expect('camila vê a ficha compartilhada por marina', '1',
    pg_temp.as_user(u_camila, format('select count(*) from characters where id=%L', c_marina)));

  perform pg_temp.expect('camila NÃO vê a ficha de rafael (não compartilhada)', '0',
    pg_temp.as_user(u_camila, format('select count(*) from characters where id=%L', c_rafael)));

  -- ---------------------------------------------------------- characters UPDATE
  perform pg_temp.expect('camila edita a própria ficha', 'linhas:1',
    pg_temp.as_user_write(u_camila, format('update characters set notes=''ok'' where id=%L', c_camila)));

  perform pg_temp.expect('camila NÃO edita a ficha de rafael', 'linhas:0',
    pg_temp.as_user_write(u_camila, format('update characters set karma=5 where id=%L', c_rafael)));

  perform pg_temp.expect('camila NÃO edita a ficha de marina (compartilhada é leitura)', 'linhas:0',
    pg_temp.as_user_write(u_camila, format('update characters set karma=5 where id=%L', c_marina)));

  perform pg_temp.expect('mestre edita ficha de jogador', 'linhas:1',
    pg_temp.as_user_write(u_mestre, format('update characters set wound=1 where id=%L', c_rafael)));

  -- ------------------------------------------------- character_directory (view)
  perform pg_temp.expect('camila vê os 5 nomes no diretório (sem ficha)', '5',
    pg_temp.as_user(u_camila, 'select count(*) from character_directory'));

  -- ------------------------------------------------------- chat_messages SELECT
  perform pg_temp.expect('camila lê a própria DM', '2',
    pg_temp.as_user(u_camila, format('select count(*) from chat_messages where channel_id=%L', dm_cm)));

  perform pg_temp.expect('rafael NÃO lê a DM camila↔marina', '0',
    pg_temp.as_user(u_rafael, format('select count(*) from chat_messages where channel_id=%L', dm_cm)));

  perform pg_temp.expect('mestre INTERCEPTA a DM camila↔marina', '2',
    pg_temp.as_user(u_mestre, format('select count(*) from chat_messages where channel_id=%L', dm_cm)));

  -- ------------------------------------------------------- chat_messages INSERT
  perform pg_temp.expect('camila escreve na própria DM', 'linhas:1',
    pg_temp.as_user_write(u_camila, format(
      'insert into chat_messages(channel_id,sender_id,type,body) values (%L,%L,''text'',''{"text":"oi"}'')',
      dm_cm, u_camila)));

  perform pg_temp.expect('mestre NÃO escreve na DM que intercepta', 'ERRO:42501',
    pg_temp.as_user_write(u_mestre, format(
      'insert into chat_messages(channel_id,sender_id,type,body) values (%L,%L,''text'',''{"text":"intromissão"}'')',
      dm_cm, u_mestre)));

  perform pg_temp.expect('rafael NÃO escreve em DM alheia', 'ERRO:42501',
    pg_temp.as_user_write(u_rafael, format(
      'insert into chat_messages(channel_id,sender_id,type,body) values (%L,%L,''text'',''{"text":"invasão"}'')',
      dm_cm, u_rafael)));

  perform pg_temp.expect('camila NÃO se passa por marina', 'ERRO:42501',
    pg_temp.as_user_write(u_camila, format(
      'insert into chat_messages(channel_id,sender_id,type,body) values (%L,%L,''text'',''{"text":"forjada"}'')',
      dm_cm, u_marina)));

  perform pg_temp.expect('jogador NÃO forja narração do mestre', 'ERRO:42501',
    pg_temp.as_user_write(u_camila, format(
      'insert into chat_messages(channel_id,sender_id,type,body) values (%L,%L,''narration'',''{"text":"falsa"}'')',
      grupo, u_camila)));

  perform pg_temp.expect('mestre narra na sala de grupo', 'linhas:1',
    pg_temp.as_user_write(u_mestre, format(
      'insert into chat_messages(channel_id,sender_id,type,body) values (%L,%L,''narration'',''{"text":"a porta cede"}'')',
      grupo, u_mestre)));

  -- ------------------------------------------------------------------ evidências
  perform pg_temp.expect('jogador lê o mural', '3',
    pg_temp.as_user(u_camila, 'select count(*) from evidence_cards'));

  perform pg_temp.expect('jogador NÃO cria cartão', 'ERRO:42501',
    pg_temp.as_user_write(u_camila, format(
      'insert into evidence_cards(campaign_id,title) values (%L,''hack'')', camp)));

  perform pg_temp.expect('jogador NÃO move cartão', 'linhas:0',
    pg_temp.as_user_write(u_camila, 'update evidence_cards set x=999'));

  perform pg_temp.expect('jogador NÃO apaga cartão', 'linhas:0',
    pg_temp.as_user_write(u_camila, 'delete from evidence_cards'));

  perform pg_temp.expect('mestre cria cartão', 'linhas:1',
    pg_temp.as_user_write(u_mestre, format(
      'insert into evidence_cards(campaign_id,title) values (%L,''pista nova'')', camp)));

  -- ------------------------------------------------------------ campaign_members
  perform pg_temp.expect('jogador NÃO se promove a mestre', 'ERRO:42501',
    pg_temp.as_user_write(u_rafael, format(
      'insert into campaign_members(campaign_id,user_id,role) values (%L,%L,''mestre'')',
      camp, u_rafael)));

  -- ------------------------------------------------------------------- campaigns
  perform pg_temp.expect('jogador NÃO edita notas de sessão', 'linhas:0',
    pg_temp.as_user_write(u_camila, format(
      'update campaigns set session_notes=''hack'' where id=%L', camp)));

  perform pg_temp.expect('mestre edita notas de sessão', 'linhas:1',
    pg_temp.as_user_write(u_mestre, format(
      'update campaigns set session_notes=''ato 2'' where id=%L', camp)));

  -- ------------------------------------------------------------ shares (o dono)
  perform pg_temp.expect('camila compartilha a PRÓPRIA ficha com bruno', 'linhas:1',
    pg_temp.as_user_write(u_camila, format(
      'insert into character_shares(character_id,shared_with_user_id) values (%L,%L)',
      c_camila, u_bruno)));

  perform pg_temp.expect('camila NÃO compartilha a ficha de rafael', 'ERRO:42501',
    pg_temp.as_user_write(u_camila, format(
      'insert into character_shares(character_id,shared_with_user_id) values (%L,%L)',
      c_rafael, u_bruno)));

  -- --------------------------------------------------------------- read_pointers
  perform pg_temp.expect('camila grava o próprio ponteiro de leitura', 'linhas:1',
    pg_temp.as_user_write(u_camila, format(
      'insert into read_pointers(channel_id,user_id,last_read_count) values (%L,%L,3)',
      dm_cm, u_camila)));

  perform pg_temp.expect('camila NÃO grava ponteiro no nome de rafael', 'ERRO:42501',
    pg_temp.as_user_write(u_camila, format(
      'insert into read_pointers(channel_id,user_id,last_read_count) values (%L,%L,3)',
      dm_cm, u_rafael)));

  -- ------------------------------------------------ anon não fala com nada disso
  perform pg_temp.expect('anon NÃO lê personagens', 'ERRO:42501',
    pg_temp.as_anon('select count(*) from characters'));

  perform pg_temp.expect('anon NÃO lê mensagens', 'ERRO:42501',
    pg_temp.as_anon('select count(*) from chat_messages'));

  perform pg_temp.expect('anon NÃO lê o diretório de personagens', 'ERRO:42501',
    pg_temp.as_anon('select count(*) from character_directory'));

  -- ...mas PODE tocar o keepalive (é o que o ping do GitHub Actions faz)
  perform pg_temp.expect('anon executa keepalive()', 'ok',
    pg_temp.as_anon('select public.keepalive()'));

  -- Sessão autenticada sem uid válido (JWT sem sub) não enxerga nada: as policies
  -- comparam com auth.uid(), que é null, então nenhuma casa.
  perform pg_temp.expect('authenticated sem uid não vê ficha alguma', '0',
    pg_temp.as_user(null, 'select count(*) from characters'));
end $$;

-- --------------------------------------------------------------------- relatório
select
  case when esperado = obtido then '  OK  ' else ' FALHA' end as "res",
  nome, esperado, obtido
from res order by ctid;

do $$
declare n int;
begin
  select count(*) into n from res where esperado <> obtido;
  if n > 0 then
    raise exception '% asserção(ões) de RLS falharam', n;
  end if;
  raise notice 'Todas as % asserções de RLS passaram.', (select count(*) from res);
end $$;

rollback;
