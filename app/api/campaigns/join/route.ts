import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";
import { ARCHETYPES, type Archetype } from "@/lib/game/rules";

/**
 * Redenção de convite. Nunca é um INSERT do client: o código de convite é curto
 * e adivinhável, então a validação (e o rate limit implícito de passar por aqui)
 * fica no servidor com a service_role.
 */
export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { inviteCode, characterName, archetype, occupation } = body ?? {};

  if (typeof inviteCode !== "string" || !inviteCode.trim()) {
    return NextResponse.json({ error: "Código de convite é obrigatório." }, { status: 400 });
  }
  if (typeof characterName !== "string" || !characterName.trim()) {
    return NextResponse.json({ error: "Nome do personagem é obrigatório." }, { status: 400 });
  }
  if (!ARCHETYPES.includes(archetype as Archetype)) {
    return NextResponse.json({ error: "Arquétipo inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_invite", {
    p_invite_code: inviteCode,
    p_user_id: user.id,
    p_character_name: characterName,
    p_archetype: archetype,
    p_occupation: typeof occupation === "string" ? occupation : "",
  });

  if (error) {
    if (error.message.includes("INVITE_NOT_FOUND")) {
      return NextResponse.json({ error: "Código de convite não encontrado." }, { status: 404 });
    }
    console.error("redeem_invite", error);
    return NextResponse.json({ error: "Não foi possível entrar na mesa." }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}
