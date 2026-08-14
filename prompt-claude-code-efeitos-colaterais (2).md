# Prompt para Claude Code — Efeitos Colaterais (implementação real)

Cole este documento inteiro como instrução inicial. Anexe também o protótipo HTML
(`efeitos-colaterais-prototipo.html`) como referência **visual e de interação** —
o objetivo é replicar fielmente essa UX/UI validada, não redesenhar do zero.

---

## 1. O que é

Site para mestre e jogadores de "Efeitos Colaterais", um RPG de investigação com
mecânica híbrida (d20 + atributo + perícia + karma). O sistema suporta
**múltiplas campanhas/mesas** (multi-tenant) rodando o mesmo jogo — um mestre pode
ter várias mesas, um jogador pode participar de mais de uma.

O protótipo HTML anexo já validou a UX destas features — implemente com a mesma
fidelidade visual (estética "dossiê policial/corkboard", fontes Special Elite +
IBM Plex Sans/Mono, paleta por arquétipo Hard/Intel/Soft):

1. **Fichas de personagem** (atributos, perícias, karma passivo + pool ativo,
   trilha de ferimento, equipamento, observações) com edição em tempo real
2. **Compartilhamento de ficha entre jogadores** — cada jogador escolhe com quem
   compartilhar a própria ficha; mestre sempre tem acesso, obrigatório
3. **Chat estilo WhatsApp**: sala de grupo + DM entre qualquer par de participantes
   (jogador↔jogador, jogador↔mestre). Mestre vê **todas** as conversas, inclusive
   as privadas entre jogadores — essas aparecem numa seção separada
   "Interceptações", com header e bordas vermelhas, banner de "modo vigilância",
   e **sem permissão de escrever** (mestre não pode se intrometer numa DM que não
   é dele)
4. **Rolagem de dados no chat**: painel inline (não modal separado) com
   atributo + perícia + karma opcional + dificuldade opcional, animação de ~3s
   antes do resultado, resultado vira um cartão especial na conversa (visível a
   quem tem acesso àquele canal — grupo vê tudo, DM só os participantes)
5. **Narração do mestre (broadcast)**: mensagem especial que o mestre dispara
   pra sala de grupo inteira, com estilo visual distinto (banner, não bolha normal)
6. **Selo de karma no papel**: a ficha reage visualmente ao karma do personagem
   (mancha/carimbo "CORROMPIDO" em karma baixo, brilho dourado "EXEMPLAR" em
   karma alto)
7. **Presença** ("visto por último", indicador online) e **badges de mensagens
   não lidas** por conversa e na pasta de comunicações
8. **Mural de evidências**: corkboard com cartões arrastáveis (mestre edita,
   jogadores veem em modo leitura), alfinete no canto superior esquerdo de cada
   cartão — arrastar o corpo do cartão move ele, arrastar a partir do alfinete
   até outro alfinete cria uma linha de conexão vermelha, clicar na linha desfaz

---

## 2. Stack (revisado — Supabase, não self-host de auth/realtime)

- **Next.js (App Router) + TypeScript**. Pode ser hospedado em Vercel (mais simples,
  já que não há mais SSE/processo persistente pra manter — o Realtime é do
  Supabase, o client se conecta direto nele) ou no VPS existente, à sua escolha.
- **Supabase** cobre: Postgres, Auth, Realtime. Plano **free**. Ver seção 7 pro
  detalhe do plano gratuito e do ping anti-pausa.
- **Padrão BFF mantido, mesmo com Supabase**: o client nunca recebe a
  `service_role key`. Toda escrita que exige lógica de negócio (validar convite,
  broadcast de narração, criação de campanha, etc.) passa por Route Handlers /
  Server Actions no Next.js, que usam a `service_role key` **só no servidor**.
  O client-side só usa a `anon key` (não é segredo) + a sessão do usuário
  (JWT do Supabase Auth) pra leitura e pra assinar canais Realtime — e tudo
  isso é filtrado por **RLS**, nunca por confiança no client.
- **RLS (Row Level Security) faz a autorização pesada** — é a maior vantagem
  de usar Supabase aqui: em vez de reimplementar todo o controle de acesso
  (dono vê a própria ficha, mestre vê tudo, compartilhamento entre jogadores,
  mestre não escreve em DM alheia) como código nosso, isso vira política SQL
  no Postgres, testável e auditável. Veja a seção 5.

---

## 3. Autenticação

- **Supabase Auth** (email + senha, ou magic link — à escolha, email+senha é
  mais direto pro fluxo "mestre convida jogador"). Sessão gerenciada pelo
  Supabase (JWT + refresh token via cookie), nada de reimplementar hash de
  senha ou sessão na mão.
- Cada pessoa tem **uma conta** (não uma conta por campanha). Dentro de uma
  campanha, a conta tem um papel (`mestre` ou `player`) e, se `player`, está
  ligada a um personagem daquela campanha — isso vive na tabela
  `campaign_members`, não no Auth.
- Fluxo de entrada numa campanha: mestre cria a campanha e gera um **código de
  convite**; jogador usa o código pra entrar (cria conta via Supabase Auth se
  ainda não tem) e é associado como `player` daquela campanha. A redenção do
  código de convite deve rodar num Route Handler com `service_role key`
  (validar o código, criar o `campaign_members` — isso não deve ser um INSERT
  direto do client, mesmo com RLS, pra evitar gente adivinhando/força-bruta em
  códigos de convite).

---

## 4. Modelo de dados

```
campaigns        (id, name, invite_code, act, synopsis, session_notes, gm_user_id, created_at)
campaign_members (id, campaign_id, user_id, role[mestre|player], character_id nullable)
characters       (id, campaign_id, owner_user_id, name, occupation, archetype,
                   attrs jsonb, skills jsonb, karma int, pool_max int, pool_spent int,
                   wound int, hook text, equip text, notes text)
character_shares (character_id, shared_with_user_id)   -- compartilhamento entre jogadores
chat_channels    (id, campaign_id, type[group|dm], name)
chat_participants(channel_id, user_id)
chat_messages    (id, channel_id, sender_id, type[text|roll|narration], body jsonb, created_at)
evidence_cards   (id, campaign_id, title, text, x, y)
evidence_links   (id, campaign_id, card_a_id, card_b_id)
read_pointers    (channel_id, user_id, last_read_count)
profiles         (user_id, last_seen)   -- online efêmero fica no Realtime Presence, não precisa de coluna
```

`user_id` em tudo referencia `auth.users.id` do Supabase — não crie uma tabela
de usuários paralela.

`chat_messages.body` guarda a mensagem de texto normal, ou os dados
estruturados de uma rolagem (`{d20, parts:[{label,value}], total, difficulty}`)
ou de uma narração (`{text}`) — igual ao protótipo.

---

## 5. RLS (a autorização vive aqui — escreva as políticas com cuidado)

- `characters`: SELECT permitido se `auth.uid() = owner_user_id`, OU existe
  linha em `campaign_members` com `user_id = auth.uid()`, `role = 'mestre'`,
  mesma `campaign_id`, OU existe linha em `character_shares` casando
  `character_id` + `shared_with_user_id = auth.uid()`. UPDATE só pro dono ou
  mestre da campanha.
- `chat_messages` / `chat_participants`: SELECT permitido se `auth.uid()` é
  participante do canal, OU é mestre da campanha daquele canal (cobre a
  "interceptação"). **INSERT só permitido se `auth.uid()` é participante do
  canal** — isso sozinho já impede o mestre de escrever numa DM
  jogador↔jogador da qual ele não participa, sem precisar de lógica extra.
- `evidence_cards` / `evidence_links`: SELECT pra qualquer membro da
  campanha (via `campaign_members`). INSERT/UPDATE/DELETE só pro mestre
  daquela campanha.
- `read_pointers`: usuário só lê/escreve a própria linha
  (`user_id = auth.uid()`).
- `campaign_members`: SELECT pra membros da mesma campanha. INSERT **não**
  direto do client — só via Route Handler com `service_role key` (redenção de
  convite, seção 3).

Escreva testes (ou pelo menos um script manual de verificação) confirmando
que um jogador comum não consegue, via client, ler uma ficha não
compartilhada nem uma DM da qual não participa — isso é o coração da
segurança do app, vale conferir na prática antes de considerar pronto.

---

## 6. Realtime

Use **Supabase Realtime** direto:
- **Postgres Changes** nas tabelas `chat_messages`, `characters`,
  `evidence_cards`, `evidence_links` — client assina o canal da campanha,
  RLS filtra o que cada usuário recebe (confirme que RLS se aplica também às
  assinaturas Realtime, não só a queries REST — é o comportamento padrão do
  Supabase, mas vale testar).
- **Presence** (feature nativa do Supabase Realtime) pra "quem está online
  agora" — não precisa de tabela nem de lógica própria pra isso, é
  exatamente o caso de uso que a feature resolve. Pra "visto por último",
  grave `profiles.last_seen = now()` num Route Handler chamado no evento de
  desconexão/logout do client.

---

## 7. Plano free + ping anti-pausa

Projeto Supabase free pausa automaticamente após 7 dias sem atividade no
banco. Solução: workflow agendado que gera uma query trivial a cada
**6 dias**, antes da pausa acontecer.

- Implemente como **GitHub Actions** com `schedule: cron: '0 6 */6 * *'`,
  fazendo uma requisição simples (ex: `select count(*) from campaigns limit 1`
  via REST do Supabase, usando a `anon key` como secret do repositório) —
  não precisa de lógica de negócio, só precisa "tocar" o banco.
- Documente no README: quais secrets o workflow precisa
  (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), e como testar manualmente rodando o
  workflow via `workflow_dispatch` além do cron.

---

## 8. O que NÃO fazer nesta fase (fora de escopo do MVP)

- Push notification nativo / service worker — Realtime já cobre "app aberto
  atualiza sozinho"; notificação com app fechado fica pra depois.
- App mobile nativo — é web responsivo (o protótipo já valida mobile+desktop).
- Motor de ficha genérico pra outros sistemas de RPG — os campos de
  atributo/perícia/karma ficam fixos ao sistema Efeitos Colaterais por agora.

---

## 9. Entregáveis esperados

1. Repositório Next.js com estrutura clara (`app/`, `lib/supabase/` — clients
   separados pro uso client-side com anon key e server-side com service role,
   nunca misturados no mesmo módulo).
2. Migrations do Supabase (schema da seção 4 + políticas RLS da seção 5)
   versionadas no repo, com seed de dados equivalente ao protótipo (5
   personagens, mensagens semente).
3. Workflow do GitHub Actions do ping anti-pausa (seção 7).
4. README de setup: variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), passo a
   passo de criar o projeto Supabase free e rodar as migrations.
5. Fidelidade visual ao protótipo anexado — pode portar as classes/CSS quase
   diretamente, adaptando pra componentes React.

Comece confirmando o schema e as políticas RLS da seção 5 comigo antes de
gerar as migrations — autorização é a parte mais fácil de errar por descuido
e mais chata de refatorar depois.
