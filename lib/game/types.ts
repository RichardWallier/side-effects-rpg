import type { Archetype, Attrs, Skills } from "./rules";

export type MemberRole = "mestre" | "player";
export type ChannelType = "group" | "dm";
export type MessageType = "text" | "roll" | "narration";

export interface Campaign {
  id: string;
  name: string;
  invite_code: string;
  act: number;
  synopsis: string;
  session_notes: string;
  gm_user_id: string;
  created_at: string;
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: MemberRole;
  character_id: string | null;
}

export interface Character {
  id: string;
  campaign_id: string;
  owner_user_id: string;
  name: string;
  occupation: string;
  archetype: Archetype;
  attrs: Attrs;
  skills: Skills;
  karma: number;
  pool_max: number;
  pool_spent: number;
  wound: number;
  hook: string;
  equip: string;
  notes: string;
}

/** View pública: nome/arquétipo de todos os personagens da campanha, sem a ficha. */
export interface CharacterDirectoryEntry {
  id: string;
  campaign_id: string;
  owner_user_id: string;
  name: string;
  archetype: Archetype;
}

export interface CharacterShare {
  character_id: string;
  shared_with_user_id: string;
}

export interface ChatChannel {
  id: string;
  campaign_id: string;
  type: ChannelType;
  name: string;
}

export interface ChatParticipant {
  channel_id: string;
  user_id: string;
}

export interface RollPart {
  label: string;
  value: number;
}

export type MessageBody = { text: string } | RollMessageBody;

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  type: MessageType;
  body: MessageBody;
  created_at: string;
}

export interface EvidenceCard {
  id: string;
  campaign_id: string;
  title: string;
  text: string;
  x: number;
  y: number;
}

export interface EvidenceLink {
  id: string;
  campaign_id: string;
  card_a_id: string;
  card_b_id: string;
}

export interface ReadPointer {
  channel_id: string;
  user_id: string;
  last_read_count: number;
}

export interface Profile {
  user_id: string;
  display_name: string;
  last_seen: string | null;
}

export interface RollMessageBody {
  roller: string;
  /** Faces do dado rolado (4, 6, 8, 12 ou 20). Ausente = registro antigo, assume 20. */
  dieSides?: number;
  /** Quantos dados foram rolados juntos. Ausente = registro antigo, assume 1. */
  dieCount?: number;
  /** Resultado de cada dado individual, na ordem rolada. Ausente = registro antigo, assume [dieResult]. */
  dieResults?: number[];
  /** Soma de todos os dados rolados (antes dos modificadores). */
  dieResult: number;
  parts: RollPart[];
  total: number;
  difficulty: number | null;
}

export const isRollBody = (m: ChatMessage): m is ChatMessage & { body: RollMessageBody } =>
  m.type === "roll";

export const textOf = (m: ChatMessage): string =>
  "text" in m.body ? m.body.text : "";

/** Snapshot completo da campanha entregue pelo server component ao provider. */
export interface CampaignSnapshot {
  campaign: Campaign;
  members: CampaignMember[];
  profiles: Profile[];
  directory: CharacterDirectoryEntry[];
  characters: Character[];
  shares: CharacterShare[];
  channels: ChatChannel[];
  participants: ChatParticipant[];
  messages: ChatMessage[];
  evidenceCards: EvidenceCard[];
  evidenceLinks: EvidenceLink[];
  readPointers: ReadPointer[];
  meId: string;
  myRole: MemberRole;
}
