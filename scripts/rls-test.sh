#!/usr/bin/env bash
#
# Sobe um Postgres descartável, aplica migrations + seed + stubs do Supabase e
# roda supabase/tests/rls_test.sql. Não toca em nenhum banco existente e apaga
# tudo no fim.
#
#   ./scripts/rls-test.sh
#
# Precisa apenas de um Postgres instalado localmente (initdb/pg_ctl/psql no PATH,
# ou em /opt/homebrew/opt/postgresql@15/bin). Não precisa de Docker, de projeto
# Supabase nem de rede.
#
# Para verificar o app de verdade — PostgREST, Supabase Auth, anon key — use
# `npm run rls:check` contra um projeto no ar. Este script cobre as policies.

set -euo pipefail

for candidate in /opt/homebrew/opt/postgresql@15/bin /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@15/bin; do
  [ -d "$candidate" ] && PATH="$candidate:$PATH"
done

command -v initdb >/dev/null || { echo "initdb não encontrado no PATH. Instale o Postgres (brew install postgresql@15)."; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=${PGTESTPORT:-55432}
TMP=$(mktemp -d "${TMPDIR:-/tmp}/ec-rls.XXXXXX")

cleanup() {
  pg_ctl -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "→ instância temporária em $TMP (porta $PORT)"
initdb -D "$TMP/data" -U postgres --auth=trust >/dev/null
# socket dentro do TMP e listen_addresses vazio: nada exposto na rede
pg_ctl -D "$TMP/data" -l "$TMP/log" \
  -o "-p $PORT -k $TMP -c listen_addresses='' -c wal_level=logical" start >/dev/null

for _ in $(seq 1 30); do
  pg_isready -h "$TMP" -p "$PORT" -q && break
  sleep 0.5
done

psql() { command psql -h "$TMP" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

psql -d postgres -c 'create database ec' >/dev/null
psql -d ec -f "$ROOT/supabase/tests/_stubs.sql" >/dev/null

echo "→ migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  printf '   %s' "$(basename "$f")"
  psql -d ec -f "$f" >/dev/null
  echo "  ok"
done

echo "→ seed"
psql -d ec -f "$ROOT/supabase/seed.sql" >/dev/null
echo "   ok"

echo "→ teste de RLS"
command psql -h "$TMP" -p "$PORT" -U postgres -d ec -v ON_ERROR_STOP=1 \
  -f "$ROOT/supabase/tests/rls_test.sql"
