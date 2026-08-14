import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";

/**
 * "Visto por último". O online/offline em tempo real é o Presence do Realtime;
 * isto aqui só grava o carimbo quando o client desconecta ou sai.
 * Chamado via navigator.sendBeacon, então tolera resposta vazia.
 */
export async function POST() {
  const { user } = await requireUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ last_seen: new Date().toISOString() })
    .eq("user_id", user.id);

  return new NextResponse(null, { status: 204 });
}
