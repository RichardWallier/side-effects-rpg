import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { loadCampaignSnapshot } from "@/lib/campaign/snapshot";
import { CampaignProvider } from "@/lib/campaign/CampaignProvider";
import { WindowManager } from "@/components/windows/WindowManager";
import { Explorer } from "@/components/Explorer";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const snapshot = await loadCampaignSnapshot(supabase, campaignId, user.id);
  if (!snapshot) notFound();

  return (
    <CampaignProvider snapshot={snapshot}>
      <WindowManager>
        <Explorer />
      </WindowManager>
    </CampaignProvider>
  );
}
