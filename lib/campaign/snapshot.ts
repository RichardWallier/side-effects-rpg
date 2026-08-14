import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignSnapshot, MemberRole } from "@/lib/game/types";

/**
 * Carrega tudo que a campanha precisa numa tacada. Todas as queries usam a
 * sessão do usuário — quem filtra é a RLS, não este código. Se um jogador não
 * pode ver uma ficha ou uma DM, ela simplesmente não vem.
 */
export async function loadCampaignSnapshot(
  supabase: SupabaseClient,
  campaignId: string,
  userId: string,
): Promise<CampaignSnapshot | null> {
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return null;

  const [
    members,
    profiles,
    directory,
    characters,
    shares,
    channels,
    participants,
    messages,
    evidenceCards,
    evidenceLinks,
    readPointers,
  ] = await Promise.all([
    supabase.from("campaign_members").select("*").eq("campaign_id", campaignId),
    supabase.from("profiles").select("*"),
    supabase.from("character_directory").select("*").eq("campaign_id", campaignId),
    supabase.from("characters").select("*").eq("campaign_id", campaignId),
    supabase.from("character_shares").select("*"),
    supabase.from("chat_channels").select("*").eq("campaign_id", campaignId),
    supabase.from("chat_participants").select("*"),
    supabase.from("chat_messages").select("*").order("created_at", { ascending: true }),
    supabase.from("evidence_cards").select("*").eq("campaign_id", campaignId),
    supabase.from("evidence_links").select("*").eq("campaign_id", campaignId),
    supabase.from("read_pointers").select("*").eq("user_id", userId),
  ]);

  const myMembership = (members.data ?? []).find((m) => m.user_id === userId);
  if (!myMembership) return null;

  const channelIds = new Set((channels.data ?? []).map((c) => c.id));
  const characterIds = new Set((characters.data ?? []).map((c) => c.id));

  return {
    campaign,
    members: members.data ?? [],
    profiles: profiles.data ?? [],
    directory: directory.data ?? [],
    characters: characters.data ?? [],
    // shares/participants/messages não têm campaign_id: recorta pela campanha atual.
    shares: (shares.data ?? []).filter((s) => characterIds.has(s.character_id)),
    channels: channels.data ?? [],
    participants: (participants.data ?? []).filter((p) => channelIds.has(p.channel_id)),
    messages: (messages.data ?? []).filter((m) => channelIds.has(m.channel_id)),
    evidenceCards: evidenceCards.data ?? [],
    evidenceLinks: evidenceLinks.data ?? [],
    readPointers: (readPointers.data ?? []).filter((r) => channelIds.has(r.channel_id)),
    meId: userId,
    myRole: myMembership.role as MemberRole,
  };
}
