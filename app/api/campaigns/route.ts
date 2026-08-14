import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";

/** Cria campanha + membership de mestre + canal de grupo, numa transação (RPC). */
export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { name, synopsis } = await request.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nome da campanha é obrigatório." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_campaign", {
    p_name: name,
    p_gm_user_id: user.id,
    p_synopsis: typeof synopsis === "string" ? synopsis : "",
  });

  if (error) {
    console.error("create_campaign", error);
    return NextResponse.json({ error: "Não foi possível criar a campanha." }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}
