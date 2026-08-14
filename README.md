# Efeitos Colaterais — mesa digital

Site para mestre e jogadores do RPG de investigação **Efeitos Colaterais**. Uma
conta por pessoa, várias mesas por conta: fichas de personagem, chat com DMs e
interceptação pelo mestre, rolagem de dados, narração em broadcast e mural de
evidências — tudo em tempo real.

Porta o protótipo `efeitos-colaterais-prototipo.html` (estética dossiê policial /
corkboard, `Special Elite` + `IBM Plex Sans/Mono`, paleta por arquétipo
Hard/Intel/Soft) para Next.js + Supabase.

## Stack

| Peça | Escolha |
| --- | --- |
| App | Next.js 15 (App Router) + React 19 + TypeScript |
| Banco / Auth / Realtime | Supabase (plano free) |
| Autorização | RLS no Postgres — não código de aplicação |
| Hospedagem | Vercel (não há processo persistente: o Realtime é do Supabase) |

O client só recebe a **anon key**. Toda escrita com lógica de negócio (criar
campanha, redimir convite, narração) passa por Route Handler que usa a
`service_role key` só no servidor. `lib/supabase/admin.ts` importa `server-only`,
então o build quebra se algum componente client encostar nela.

## Estrutura

```
app/
  login/ cadastro/            entrada (Supabase Auth, email + senha)
  campanhas/                  lista de mesas · criar mesa · entrar por convite
  c/[campaignId]/             a mesa: Explorer + janelas
  api/campaigns/              POST cria campanha           (service_role)
  api/campaigns/join/         POST redime convite          (service_role)
  api/broadcast/              POST narração do mestre       (service_role)
  api/presence/offline/       POST grava profiles.last_seen (sendBeacon)
  auth/signout/
components/
  Explorer.tsx                desktop de pastas
  windows/WindowManager.tsx   janelas empilhadas
  DossieWindow.tsx            ficha (atributos, perícias, karma, ferimento)
  chat/ChatWindow.tsx         conversas, DMs, interceptações
  chat/RollPanel.tsx          painel de rolagem inline (~3s de animação)
  BoardWindow.tsx             mural de evidências (arrastar, alfinetar, conectar)
  MasterPanelWindow.tsx       painel do mestre + sinopse
  BroadcastWindow.tsx  ReferenceWindow.tsx  Folder.tsx  CommitField.tsx
lib/
  supabase/client.ts          browser — anon key
  supabase/server.ts          Server Components / Route Handlers — anon + cookies
  supabase/admin.ts           service_role — server-only
  supabase/middleware.ts      renovação de sessão + guarda de rota
  campaign/snapshot.ts        leitura inicial (server)
  campaign/CampaignProvider.tsx  estado + assinaturas Realtime + mutações
  game/rules.ts  game/types.ts
supabase/
  migrations/                 schema, RLS, funções, realtime, keepalive
  seed.sql                    dados equivalentes ao protótipo
  tests/rls_test.sql          36 asserções sobre as policies
  tests/_stubs.sql            auth.users / auth.uid() falsos, só pro teste local
scripts/
  rls-test.sh                 sobe Postgres descartável e roda rls_test.sql
  rls-check.ts                mesma verificação via REST, num projeto no ar
.github/workflows/            ping anti-pausa
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

| Variável | Valor no painel | Onde vive | Para quê |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | client + servidor | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **publishable key** (`sb_publishable_…`) | client + servidor | leitura e Realtime sob RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret key** (`sb_secret_…`) | **só servidor** | Route Handlers. Nunca prefixe com `NEXT_PUBLIC_` |
| `RLS_CHECK_PASSWORD` | — | só local | senha dos usuários do seed (padrão `efeitos123`) |

Tudo em **Project Settings → API / API Keys**. O Supabase renomeou as chaves: a
*publishable key* é a antiga `anon` (segura no browser, sujeita a RLS) e a *secret
key* é a antiga `service_role` (ignora RLS — só servidor). A secret não aparece no
dropdown "Connect"; é preciso revelá-la em **API Keys**.

Projeto antigo com chaves em formato JWT (`eyJhbGciOi…`) continua funcionando:
use `anon` no lugar da publishable e `service_role` no lugar da secret.

## Setup do projeto Supabase free

1. Crie a conta em [supabase.com](https://supabase.com) e clique em **New
   project**. Anote a senha do banco; escolha a região mais próxima. O plano free
   é o padrão.
2. Espere o provisionamento (~2 min) e copie `URL`, `anon key` e
   `service_role key` de **Project Settings → API** para o `.env.local`.
3. Aplique as migrations, na ordem dos nomes de arquivo. Duas opções:

   **a) SQL Editor** (sem instalar nada) — abra **SQL Editor → New query** e cole
   o conteúdo de cada arquivo de `supabase/migrations/`, um por vez, na ordem:

   ```
   20260814120000_schema.sql     tabelas, enums, triggers
   20260814120001_rls.sql        políticas de autorização
   20260814120002_functions.sql  create_campaign, redeem_invite, broadcast
   20260814120003_realtime.sql   publication + replica identity
   20260814120004_keepalive.sql  função do ping anti-pausa
   ```

   **b) CLI** — precisa do [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```bash
   supabase init            # cria supabase/config.toml (não versionado aqui)
   supabase link --project-ref <ref-do-projeto>
   supabase db push
   ```

4. *(Opcional)* Seed com os dados do protótipo — 1 mestre + 5 jogadores, mesa
   "Caso #2019-114", fichas, compartilhamentos, mensagens e mural. Cole
   `supabase/seed.sql` no SQL Editor **depois** das migrations. Ele cria usuários
   direto em `auth.users`; senha de todos: `efeitos123`.

   | E-mail | Papel |
   | --- | --- |
   | `mestre@efeitos.local` | mestre |
   | `camila@efeitos.local` · `bruno@efeitos.local` · `rafael@efeitos.local` · `marina@efeitos.local` · `diego@efeitos.local` | jogadores |

   Código de convite da mesa semeada: **`EFC114`**.

5. Em **Authentication → Providers → Email**, desligue *Confirm email* se quiser
   que o cadastro entre direto sem caixa de entrada (o seed já marca os usuários
   como confirmados).

## Rodando

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # build de produção
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (next/core-web-vitals + next/typescript)
npm run rls:test     # 36 asserções de RLS num Postgres descartável (sem rede)
npm run rls:check    # RLS via REST num projeto no ar (precisa do seed aplicado)
```

Sem seed, o fluxo é: cadastro → **Criar mesa** (você vira mestre e recebe um
código de convite) → outra conta usa o código em **Entrar com convite**.

## Autorização (RLS)

A autorização inteira vive em `20260814120001_rls.sql`. O resumo:

- **`characters`** — SELECT pro dono, pro mestre da campanha, ou pra quem a ficha
  foi compartilhada. UPDATE só dono ou mestre (compartilhamento é leitura).
- **`chat_messages`** — SELECT pra participante do canal **ou** mestre da
  campanha (é isso que dá a interceptação). INSERT exige participação: sozinho,
  isso impede o mestre de escrever numa DM jogador↔jogador. Um `sender_id =
  auth.uid()` evita remetente falsificado e um teste extra impede jogador de
  forjar `type = 'narration'`.
- **`evidence_cards` / `evidence_links`** — leitura pra membro, escrita só mestre.
- **`read_pointers`** — só a própria linha.
- **`campaign_members`** — sem INSERT do client. Redenção de convite é
  server-side, senão dá pra forçar bruta em código de convite de 6 caracteres.

Duas notas de implementação que não são cosméticas:

- As checagens passam por funções `SECURITY DEFINER` (`is_campaign_member`,
  `is_channel_participant`, …). Sem isso, uma policy em `campaign_members` que
  consultasse `campaign_members` recursaria infinitamente — a subquery reaplica a
  RLS da tabela alvo.
- A view `character_directory` (`security_invoker = off`) expõe **só** nome e
  arquétipo de todos os personagens da mesa. É o que o Explorer usa pra desenhar
  as pastas trancadas e o chat pra rotular DMs, sem vazar ficha.

### Conferindo na prática

Duas verificações, em camadas diferentes. Ambas falham com código de saída
diferente de zero se qualquer asserção quebrar.

**`npm run rls:test`** — as *policies*, sem depender de nada externo. Sobe um
Postgres descartável, aplica migrations + seed, impersona cada usuário com
`set role authenticated` + `request.jwt.claim.sub` (de onde `auth.uid()` lê) e roda
as 36 asserções de `supabase/tests/rls_test.sql`. Não precisa de Docker, de
projeto Supabase nem de rede — só de um Postgres instalado
(`brew install postgresql@15`). Não toca em nenhum banco existente: a instância
nasce num diretório temporário, com socket local e `listen_addresses` vazio, e é
apagada no fim.

Estado atual: **36/36 passando**. As que cobrem o que o briefing chama de coração
da segurança do app:

```
OK  camila NÃO vê a ficha de rafael (não compartilhada)  0           0
OK  rafael NÃO lê a DM camila↔marina                     0           0
OK  mestre INTERCEPTA a DM camila↔marina                 2           2
OK  mestre NÃO escreve na DM que intercepta              ERRO:42501  ERRO:42501
OK  jogador NÃO forja narração do mestre                 ERRO:42501  ERRO:42501
OK  camila NÃO se passa por marina                       ERRO:42501  ERRO:42501
OK  jogador NÃO se promove a mestre                      ERRO:42501  ERRO:42501
OK  anon NÃO lê personagens                              ERRO:42501  ERRO:42501
```

**`npm run rls:check`** — o caminho de verdade, ponta a ponta: loga via Supabase
Auth e fala com PostgREST usando a **anon key**, exatamente o que um client tem na
mão. Pega o que o teste SQL não pega (grants de REST, exposição de schema, a view
`character_directory` servida por HTTP). Precisa de um projeto no ar com o seed
aplicado.

`supabase/tests/_stubs.sql` existe só pro `rls:test`: recria `auth.users`,
`auth.uid()` e os papéis `anon`/`authenticated` que o Supabase provê. **Não
aplique num projeto Supabase de verdade.**

## Realtime

`CampaignProvider` assina um canal por campanha com **Postgres Changes** em
`chat_messages`, `characters`, `evidence_cards`, `evidence_links`, `campaigns`,
`character_shares` e `campaign_members`. A RLS filtra o que cada assinatura
entrega — não há filtro de segurança no client.

`chat_messages` não tem `campaign_id`, então não dá pra filtrar server-side; o
client descarta o que não é de um canal conhecido (é o caso de quem participa de
duas mesas). Mudança estrutural — jogador novo entrou, ficha passou a ser
compartilhada comigo — dispara um refetch do recorte da campanha, porque a linha
que mudou não é a linha que passei a enxergar.

Quem está online agora vem do **Presence** do Realtime, sem tabela. "Visto por
último" é `profiles.last_seen`, gravado por `sendBeacon` em `/api/presence/offline`
no `pagehide`.

`20260814120003_realtime.sql` marca as tabelas com `replica identity full`: sem
isso o WAL só carrega a PK e o Realtime não tem colunas suficientes pra avaliar a
RLS num UPDATE/DELETE.

## Ping anti-pausa

Projeto free pausa após **7 dias** sem atividade no banco.
`.github/workflows/supabase-keepalive.yml` chama a função `keepalive()` via REST.

Secrets do repositório (**Settings → Secrets and variables → Actions**):

| Secret | Valor |
| --- | --- |
| `SUPABASE_URL` | mesmo valor de `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | mesmo valor de `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

Teste manual sem esperar o cron: **Actions → Supabase keepalive → Run workflow**
(o `workflow_dispatch` está habilitado). Ou local:

```bash
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/keepalive" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -d '{}'
# "ok"
```

Um desvio do briefing, de propósito: o ping chama uma **RPC**, não
`select count(*) from campaigns`. A migration de RLS faz `revoke all ... from
anon` em todas as tabelas, então o REST anônimo levaria "permission denied" — e um
erro de permissão não é atividade de banco confiável pro heurístico de pausa.
`keepalive()` roda como owner, toca uma tabela de verdade e devolve só `"ok"`.

O cron é o `0 6 */6 * *` do briefing. No campo dia-do-mês, `*/6` expande pra
1, 7, 13, 19, 25, 31 — intervalo máximo de **6 dias** (do 25 pro dia 1 do mês
seguinte, em mês de 30 dias). Cabe na janela de 7 dias, com 1 dia de margem.

Duas ressalvas sobre essa margem:

- ⚠️ Ela **não** sobrevive a uma execução pulada. O GitHub pode atrasar ou
  descartar agendamentos sob carga; um agendamento perdido vira intervalo de 12
  dias e o projeto pausa. Se acontecer, troque por `0 6 * * *` (diário) — o job
  leva ~10s e Actions é free pra repositório público.
- ⚠️ O GitHub desabilita workflows agendados em repositório sem commits por **60
  dias**. Se a mesa ficar parada muito tempo, reabilite em **Actions**.

## Deploy (Vercel)

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. Configure as três variáveis de ambiente da tabela acima em **Settings →
   Environment Variables** (Production + Preview).
3. Deploy. Não há passo extra: sem SSE e sem processo persistente, o client fala
   Realtime direto com o Supabase.

## Fora de escopo (por decisão, não por esquecimento)

Push notification nativo / service worker, app mobile nativo e motor de ficha
genérico pra outros sistemas de RPG. Os campos de atributo/perícia/karma são
fixos ao sistema Efeitos Colaterais.
