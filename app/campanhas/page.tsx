import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import CampaignsClient from "./CampaignsClient";

export const dynamic = "force-dynamic";

export default async function CampanhasPage() {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const [{ data: members }, { data: profile }] = await Promise.all([
    supabase
      .from("campaign_members")
      .select("role, campaigns(id, name, act, invite_code)")
      .eq("user_id", user.id),
    supabase.from("profiles").select("display_name").eq("user_id", user.id).single(),
  ]);

  type Row = {
    role: "mestre" | "player";
    campaigns: { id: string; name: string; act: number; invite_code: string } | null;
  };

  const campaigns = ((members ?? []) as unknown as Row[])
    .filter((m) => m.campaigns)
    .map((m) => ({ ...m.campaigns!, role: m.role }));

  return (
    <CampaignsClient
      campaigns={campaigns}
      displayName={profile?.display_name ?? user.email ?? ""}
    />
  );
}
