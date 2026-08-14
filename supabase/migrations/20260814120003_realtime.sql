-- Realtime (seção 6). O client assina Postgres Changes e a RLS de cada tabela
-- filtra o que chega em cada assinatura — não há filtro no client.
--
-- REPLICA IDENTITY FULL é necessário pra que a RLS possa ser avaliada em
-- UPDATE/DELETE: sem ele o WAL só carrega a PK e o Realtime não tem colunas
-- suficientes pra decidir quem pode ver o evento.

alter table public.chat_messages     replica identity full;
alter table public.chat_channels     replica identity full;
alter table public.chat_participants replica identity full;
alter table public.characters        replica identity full;
alter table public.character_shares  replica identity full;
alter table public.evidence_cards    replica identity full;
alter table public.evidence_links    replica identity full;
alter table public.campaigns         replica identity full;
alter table public.campaign_members  replica identity full;

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_channels;
alter publication supabase_realtime add table public.chat_participants;
alter publication supabase_realtime add table public.characters;
alter publication supabase_realtime add table public.character_shares;
alter publication supabase_realtime add table public.evidence_cards;
alter publication supabase_realtime add table public.evidence_links;
alter publication supabase_realtime add table public.campaigns;
alter publication supabase_realtime add table public.campaign_members;
