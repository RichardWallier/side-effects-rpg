import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";

/** Narração do mestre pra sala de grupo. A RPC revalida o papel no banco. */
export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { campaignId, text } = await request.json().catch(() => ({}));
  if (typeof campaignId !== "string" || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "campaignId e text são obrigatórios." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("broadcast_narration", {
    p_campaign_id: campaignId,
    p_gm_user_id: user.id,
    p_text: text,
  });

  if (error) {
    if (error.message.includes("NOT_GM")) {
      return NextResponse.json({ error: "Só o mestre narra." }, { status: 403 });
    }
    console.error("broadcast_narration", error);
    return NextResponse.json({ error: "Não foi possível transmitir." }, { status: 500 });
  }

  return NextResponse.json({ message: data });
}
