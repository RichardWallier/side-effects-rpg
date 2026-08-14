-- Ping anti-pausa (seção 7). Chamado pelo GitHub Actions com a anon key.
--
-- Por que uma função em vez de `select count(*) from campaigns`: a migration de
-- RLS faz `revoke all ... from anon` em todas as tabelas, então o REST anônimo
-- levaria "permission denied" — e um erro de permissão não é atividade de banco
-- confiável pro heurístico de pausa do Supabase. Esta função roda como owner,
-- toca uma tabela de verdade e devolve só 'ok', sem revelar nada.

create or replace function public.keepalive()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform count(*) from public.campaigns;
  return 'ok';
end;
$$;

revoke execute on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
