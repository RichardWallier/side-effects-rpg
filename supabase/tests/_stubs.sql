-- Stubs do que o Supabase provê e as migrations assumem existir. Serve só pra
-- rodar as migrations + o teste de RLS num Postgres cru (ver scripts/rls-test.sh).
-- NÃO aplique isto num projeto Supabase de verdade.

create schema if not exists extensions;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon;          end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role;  end if;
end $$;

create table auth.users (
  id                     uuid primary key,
  email                  text,
  raw_user_meta_data     jsonb default '{}'::jsonb,
  instance_id            uuid,
  aud                    text,
  role                   text,
  encrypted_password     text,
  email_confirmed_at     timestamptz,
  raw_app_meta_data      jsonb,
  created_at             timestamptz,
  updated_at             timestamptz,
  confirmation_token     text,
  email_change           text,
  email_change_token_new text,
  recovery_token         text
);

create table auth.identities (
  provider_id     text,
  user_id         uuid,
  identity_data   jsonb,
  provider        text,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz
);

-- No Supabase auth.uid() lê o claim `sub` do JWT. O teste injeta esse valor com
-- set_config('request.jwt.claim.sub', ...), então a leitura aqui é equivalente.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create publication supabase_realtime;
