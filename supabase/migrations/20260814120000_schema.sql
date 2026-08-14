-- Efeitos Colaterais — schema base (seção 4 do briefing)
-- user_id sempre referencia auth.users.id; não existe tabela de usuários paralela.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.member_role  as enum ('mestre', 'player');
create type public.channel_type as enum ('group', 'dm');
create type public.message_type as enum ('text', 'roll', 'narration');
create type public.archetype    as enum ('Hard', 'Intel', 'Soft');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  last_seen    timestamptz
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- campaigns
create table public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  invite_code   text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  act           int  not null default 1 check (act between 1 and 4),
  synopsis      text not null default '',
  session_notes text not null default '',
  gm_user_id    uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index campaigns_gm_idx on public.campaigns (gm_user_id);

-- ---------------------------------------------------------------- characters
create table public.characters (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  occupation    text not null default '',
  archetype     public.archetype not null default 'Intel',
  attrs         jsonb not null default
                  '{"Físico":3,"Reflexo":3,"Intelecto":3,"Percepção":3,"Empatia":3,"Influência":3}'::jsonb,
  skills        jsonb not null default '{}'::jsonb,
  karma         int  not null default 0 check (karma between -5 and 5),
  pool_max      int  not null default 3 check (pool_max between 0 and 10),
  pool_spent    int  not null default 0 check (pool_spent >= 0),
  wound         int  not null default 0 check (wound between 0 and 4),
  hook          text not null default '',
  equip         text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint characters_pool_spent_within_max check (pool_spent <= pool_max),
  constraint characters_one_per_owner_per_campaign unique (campaign_id, owner_user_id)
);

create index characters_campaign_idx on public.characters (campaign_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger characters_touch_updated_at
  before update on public.characters
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- membership
create table public.campaign_members (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.member_role not null,
  character_id uuid references public.characters (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create index campaign_members_user_idx on public.campaign_members (user_id);

-- ---------------------------------------------------------------- shares
create table public.character_shares (
  character_id        uuid not null references public.characters (id) on delete cascade,
  shared_with_user_id uuid not null references auth.users (id) on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (character_id, shared_with_user_id)
);

create index character_shares_user_idx on public.character_shares (shared_with_user_id);

-- ---------------------------------------------------------------- chat
create table public.chat_channels (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  type        public.channel_type not null,
  name        text not null,
  created_at  timestamptz not null default now()
);

create index chat_channels_campaign_idx on public.chat_channels (campaign_id);

-- só um canal de grupo por campanha
create unique index chat_channels_one_group_per_campaign
  on public.chat_channels (campaign_id) where type = 'group';

create table public.chat_participants (
  channel_id uuid not null references public.chat_channels (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  primary key (channel_id, user_id)
);

create index chat_participants_user_idx on public.chat_participants (user_id);

create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels (id) on delete cascade,
  sender_id  uuid not null references auth.users (id) on delete cascade,
  type       public.message_type not null default 'text',
  -- text/narration: {"text": "..."}
  -- roll:           {"roller","d20","parts":[{"label","value"}],"total","difficulty"}
  body       jsonb not null,
  created_at timestamptz not null default now()
);

create index chat_messages_channel_created_idx
  on public.chat_messages (channel_id, created_at);

-- ---------------------------------------------------------------- evidências
create table public.evidence_cards (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title       text not null default '',
  text        text not null default '',
  x           double precision not null default 0,
  y           double precision not null default 0,
  created_at  timestamptz not null default now()
);

create index evidence_cards_campaign_idx on public.evidence_cards (campaign_id);

create table public.evidence_links (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  card_a_id   uuid not null references public.evidence_cards (id) on delete cascade,
  card_b_id   uuid not null references public.evidence_cards (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint evidence_links_no_self check (card_a_id <> card_b_id)
);

create index evidence_links_campaign_idx on public.evidence_links (campaign_id);

-- ligação é não-ordenada: (a,b) e (b,a) são a mesma
create unique index evidence_links_pair_uniq
  on public.evidence_links (least(card_a_id, card_b_id), greatest(card_a_id, card_b_id));

-- ---------------------------------------------------------------- leitura
create table public.read_pointers (
  channel_id      uuid not null references public.chat_channels (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  last_read_count int not null default 0 check (last_read_count >= 0),
  updated_at      timestamptz not null default now(),
  primary key (channel_id, user_id)
);
