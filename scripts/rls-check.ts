/**
 * Verificação prática da RLS (seção 5 do briefing).
 *
 * Roda contra o banco com o seed aplicado, usando a anon key — exatamente o que
 * um client tem na mão. Se qualquer asserção falhar, a autorização está furada.
 *
 *   npm run rls:check
 *
 * Requer NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente
 * (o script lê .env.local se existir).
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // arquivo não existe, segue com o ambiente
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = process.env.RLS_CHECK_PASSWORD ?? "efeitos123";

if (!URL || !ANON) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

let failures = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  ✔ ${label}`);
  } else {
    failures++;
    console.error(`  ✘ ${label}`);
    if (detail !== undefined) console.error("    →", detail);
  }
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return client;
}

async function main() {
  const mestre = await signIn("mestre@efeitos.local");
  const camila = await signIn("camila@efeitos.local");
  const rafael = await signIn("rafael@efeitos.local");

  const { data: allCharacters } = await mestre.from("characters").select("id, name, owner_user_id");
  const byName = new Map((allCharacters ?? []).map((c) => [c.name, c]));
  const camilaChar = byName.get("Camila Duarte")!;
  const marinaChar = byName.get("Marina Costa")!;
  const rafaelChar = byName.get("Rafael Nunes")!;

  const { data: channels } = await mestre.from("chat_channels").select("id, name, type");
  const { data: participants } = await mestre.from("chat_participants").select("*");

  const dmCamilaMarina = (channels ?? []).find((ch) => {
    if (ch.type !== "dm") return false;
    const users = (participants ?? [])
      .filter((p) => p.channel_id === ch.id)
      .map((p) => p.user_id);
    return users.includes(camilaChar.owner_user_id) && users.includes(marinaChar.owner_user_id);
  })!;

  console.log("\ncharacters — leitura");
  check("mestre vê as 5 fichas", (allCharacters ?? []).length === 5, allCharacters?.length);

  const { data: camilaSees } = await camila.from("characters").select("id, name");
  const camilaNames = new Set((camilaSees ?? []).map((c) => c.name));
  check("camila vê a própria ficha", camilaNames.has("Camila Duarte"));
  check("camila vê a ficha compartilhada por marina", camilaNames.has("Marina Costa"));
  check(
    "camila NÃO vê a ficha de rafael (não compartilhada)",
    !camilaNames.has("Rafael Nunes"),
    [...camilaNames],
  );
  check(
    "camila NÃO vê ficha não compartilhada nem consultando pelo id",
    (await camila.from("characters").select("id").eq("id", rafaelChar.id)).data?.length === 0,
  );

  console.log("\ncharacters — escrita");
  const { data: hijack } = await camila
    .from("characters")
    .update({ karma: 5 })
    .eq("id", rafaelChar.id)
    .select();
  check("camila NÃO edita a ficha de rafael", (hijack ?? []).length === 0, hijack);

  const { data: shared } = await camila
    .from("characters")
    .update({ karma: 5 })
    .eq("id", marinaChar.id)
    .select();
  check(
    "camila NÃO edita a ficha de marina (compartilhada é leitura)",
    (shared ?? []).length === 0,
    shared,
  );

  const { error: ownError } = await camila
    .from("characters")
    .update({ notes: "checado" })
    .eq("id", camilaChar.id);
  check("camila edita a própria ficha", !ownError, ownError?.message);

  console.log("\nchat_messages — leitura");
  const { data: rafaelMsgs } = await rafael
    .from("chat_messages")
    .select("id")
    .eq("channel_id", dmCamilaMarina.id);
  check("rafael NÃO lê a DM camila↔marina", (rafaelMsgs ?? []).length === 0, rafaelMsgs);

  const { data: camilaMsgs } = await camila
    .from("chat_messages")
    .select("id")
    .eq("channel_id", dmCamilaMarina.id);
  check("camila lê a própria DM", (camilaMsgs ?? []).length === 2, camilaMsgs?.length);

  const { data: gmMsgs } = await mestre
    .from("chat_messages")
    .select("id")
    .eq("channel_id", dmCamilaMarina.id);
  check("mestre intercepta a DM camila↔marina", (gmMsgs ?? []).length === 2, gmMsgs?.length);

  console.log("\nchat_messages — escrita");
  const { error: gmWrite } = await mestre.from("chat_messages").insert({
    channel_id: dmCamilaMarina.id,
    sender_id: (await mestre.auth.getUser()).data.user!.id,
    type: "text",
    body: { text: "intromissão" },
  });
  check("mestre NÃO escreve na DM que ele intercepta", !!gmWrite, gmWrite?.message);

  const { error: rafaelWrite } = await rafael.from("chat_messages").insert({
    channel_id: dmCamilaMarina.id,
    sender_id: (await rafael.auth.getUser()).data.user!.id,
    type: "text",
    body: { text: "invasão" },
  });
  check("rafael NÃO escreve em DM alheia", !!rafaelWrite, rafaelWrite?.message);

  const camilaId = (await camila.auth.getUser()).data.user!.id;
  const { error: spoof } = await camila.from("chat_messages").insert({
    channel_id: dmCamilaMarina.id,
    sender_id: marinaChar.owner_user_id,
    type: "text",
    body: { text: "falsificando remetente" },
  });
  check("camila NÃO envia mensagem se passando por marina", !!spoof, spoof?.message);

  const { error: fakeNarration } = await camila.from("chat_messages").insert({
    channel_id: dmCamilaMarina.id,
    sender_id: camilaId,
    type: "narration",
    body: { text: "narração falsa" },
  });
  check("jogador NÃO forja narração do mestre", !!fakeNarration, fakeNarration?.message);

  console.log("\nevidence — escrita só do mestre");
  const { data: campaigns } = await camila.from("campaigns").select("id").limit(1);
  const campaignId = campaigns![0].id;
  const { error: cardWrite } = await camila
    .from("evidence_cards")
    .insert({ campaign_id: campaignId, title: "hack", text: "" });
  check("jogador NÃO cria cartão no mural", !!cardWrite, cardWrite?.message);

  const { data: cards } = await camila.from("evidence_cards").select("id");
  check("jogador lê o mural", (cards ?? []).length === 3, cards?.length);

  console.log("\ncampaign_members — sem INSERT do client");
  const { error: memberWrite } = await rafael
    .from("campaign_members")
    .insert({ campaign_id: campaignId, user_id: camilaId, role: "mestre" });
  check("jogador NÃO se promove a mestre", !!memberWrite, memberWrite?.message);

  console.log("\ncampaigns — notas de sessão são do mestre");
  const { error: campWrite } = await camila
    .from("campaigns")
    .update({ session_notes: "hack" })
    .eq("id", campaignId);
  const { data: campAfter } = await mestre
    .from("campaigns")
    .select("session_notes")
    .eq("id", campaignId)
    .single();
  check(
    "jogador NÃO edita a campanha",
    !!campWrite || !campAfter?.session_notes.startsWith("hack"),
    campWrite?.message,
  );

  console.log(
    failures === 0
      ? "\n✅ Todas as verificações passaram.\n"
      : `\n❌ ${failures} verificação(ões) falharam.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
