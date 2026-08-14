"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { COLORS, initialsOf, type Archetype } from "@/lib/game/rules";
import type {
  Campaign,
  CampaignMember,
  CampaignSnapshot,
  ChatChannel,
  ChatMessage,
  ChatParticipant,
  Character,
  CharacterDirectoryEntry,
  CharacterShare,
  EvidenceCard,
  EvidenceLink,
  MemberRole,
  Profile,
  ReadPointer,
  RollMessageBody,
} from "@/lib/game/types";

export interface ParticipantMeta {
  id: string;
  name: string;
  color: string;
  initials: string;
  role: MemberRole;
}

interface CampaignContextValue {
  meId: string;
  myRole: MemberRole;
  isGM: boolean;
  campaign: Campaign;
  members: CampaignMember[];
  directory: CharacterDirectoryEntry[];
  characters: Character[];
  shares: CharacterShare[];
  channels: ChatChannel[];
  participants: ChatParticipant[];
  cards: EvidenceCard[];
  links: EvidenceLink[];
  onlineIds: Set<string>;

  myCharacter: Character | null;
  visibleChannels: ChatChannel[];
  participantsOf: (channelId: string) => string[];
  metaOf: (userId: string) => ParticipantMeta;
  presenceLabel: (userId: string) => string;
  messagesOf: (channelId: string) => ChatMessage[];
  isIntercept: (channel: ChatChannel) => boolean;
  canEditCharacter: (character: Character) => boolean;
  sharedWith: (characterId: string) => string[];
  unreadOf: (channelId: string) => number;
  totalUnread: number;

  patchCharacter: (id: string, patch: Partial<Character>) => Promise<void>;
  setShare: (characterId: string, userId: string, on: boolean) => Promise<void>;
  sendText: (channelId: string, text: string) => Promise<void>;
  sendRoll: (channelId: string, roll: RollMessageBody) => Promise<void>;
  broadcast: (text: string) => Promise<string | null>;
  markRead: (channelId: string) => void;
  patchCampaign: (patch: Partial<Campaign>) => Promise<void>;
  addCard: (title: string, text: string) => Promise<void>;
  moveCard: (id: string, x: number, y: number) => void;
  removeCard: (id: string) => Promise<void>;
  addLink: (a: string, b: string) => Promise<void>;
  removeLink: (a: string, b: string) => Promise<void>;
}

const Ctx = createContext<CampaignContextValue | null>(null);

export function useCampaign() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCampaign fora de <CampaignProvider>");
  return value;
}

const upsertById = <T extends { id: string }>(list: T[], row: T) =>
  list.some((r) => r.id === row.id) ? list.map((r) => (r.id === row.id ? row : r)) : [...list, row];

export function CampaignProvider({
  snapshot,
  children,
}: {
  snapshot: CampaignSnapshot;
  children: React.ReactNode;
}) {
  const supabase = supabaseBrowser();
  const { meId, myRole } = snapshot;
  const isGM = myRole === "mestre";

  const [campaign, setCampaign] = useState(snapshot.campaign);
  const [members, setMembers] = useState(snapshot.members);
  const [profiles, setProfiles] = useState(snapshot.profiles);
  const [directory, setDirectory] = useState(snapshot.directory);
  const [characters, setCharacters] = useState(snapshot.characters);
  const [shares, setShares] = useState(snapshot.shares);
  const [channels, setChannels] = useState(snapshot.channels);
  const [participants, setParticipants] = useState(snapshot.participants);
  const [messages, setMessages] = useState(snapshot.messages);
  const [cards, setCards] = useState(snapshot.evidenceCards);
  const [links, setLinks] = useState(snapshot.evidenceLinks);
  const [readPointers, setReadPointers] = useState(snapshot.readPointers);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set([meId]));

  const campaignId = campaign.id;

  /* ------------------------------------------------------------ refetch
     Mudanças estruturais (jogador novo entrou, ficha passou a ser
     compartilhada comigo) trazem linhas que a assinatura sozinha não explica —
     aí vale reler o recorte da campanha. */
  const refetchStructure = useCallback(async () => {
    const [ch, pt, ca, dir, mem, pr, sh] = await Promise.all([
      supabase.from("chat_channels").select("*").eq("campaign_id", campaignId),
      supabase.from("chat_participants").select("*"),
      supabase.from("characters").select("*").eq("campaign_id", campaignId),
      supabase.from("character_directory").select("*").eq("campaign_id", campaignId),
      supabase.from("campaign_members").select("*").eq("campaign_id", campaignId),
      supabase.from("profiles").select("*"),
      supabase.from("character_shares").select("*"),
    ]);

    const channelIds = new Set((ch.data ?? []).map((c) => c.id));
    const characterIds = new Set((ca.data ?? []).map((c) => c.id));

    if (ch.data) setChannels(ch.data);
    if (pt.data) setParticipants(pt.data.filter((p) => channelIds.has(p.channel_id)));
    if (ca.data) setCharacters(ca.data);
    if (dir.data) setDirectory(dir.data);
    if (mem.data) setMembers(mem.data);
    if (pr.data) setProfiles(pr.data);
    if (sh.data) setShares(sh.data.filter((s) => characterIds.has(s.character_id)));

    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true });
    if (msgs) setMessages(msgs.filter((m) => channelIds.has(m.channel_id)));
  }, [supabase, campaignId]);

  /* ------------------------------------------------------------ realtime */
  const channelIdSet = useMemo(() => new Set(channels.map((c) => c.id)), [channels]);
  const channelIdSetRef = useRef(channelIdSet);
  channelIdSetRef.current = channelIdSet;

  useEffect(() => {
    const rt: RealtimeChannel = supabase.channel(`campaign:${campaignId}`, {
      config: { presence: { key: meId } },
    });

    // chat_messages não tem campaign_id, então não dá pra filtrar server-side.
    // A RLS já garante que só chega o que este usuário pode ler; o descarte
    // abaixo é só pra ignorar mensagens de OUTRA campanha do mesmo usuário.
    rt.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_messages" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as ChatMessage;
          setMessages((prev) => prev.filter((m) => m.id !== old.id));
          return;
        }
        const row = payload.new as ChatMessage;
        if (!channelIdSetRef.current.has(row.channel_id)) {
          void refetchStructure();
          return;
        }
        setMessages((prev) =>
          prev.some((m) => m.id === row.id)
            ? prev.map((m) => (m.id === row.id ? row : m))
            : [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at)),
        );
      },
    );

    rt.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "characters",
        filter: `campaign_id=eq.${campaignId}`,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as Character;
          setCharacters((prev) => prev.filter((c) => c.id !== old.id));
          return;
        }
        setCharacters((prev) => upsertById(prev, payload.new as Character));
      },
    );

    rt.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "evidence_cards",
        filter: `campaign_id=eq.${campaignId}`,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as EvidenceCard;
          setCards((prev) => prev.filter((c) => c.id !== old.id));
          return;
        }
        setCards((prev) => upsertById(prev, payload.new as EvidenceCard));
      },
    );

    rt.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "evidence_links",
        filter: `campaign_id=eq.${campaignId}`,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as EvidenceLink;
          setLinks((prev) => prev.filter((l) => l.id !== old.id));
          return;
        }
        setLinks((prev) => upsertById(prev, payload.new as EvidenceLink));
      },
    );

    rt.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "campaigns", filter: `id=eq.${campaignId}` },
      (payload) => setCampaign(payload.new as Campaign),
    );

    // Compartilhamento novo/removido muda QUAIS fichas eu enxergo — a linha da
    // ficha em si não mudou, então só um refetch resolve.
    rt.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "character_shares" },
      () => void refetchStructure(),
    );

    rt.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "campaign_members",
        filter: `campaign_id=eq.${campaignId}`,
      },
      () => void refetchStructure(),
    );

    rt.on("presence", { event: "sync" }, () => {
      setOnlineIds(new Set(Object.keys(rt.presenceState())));
    });

    rt.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void rt.track({ user_id: meId, online_at: new Date().toISOString() });
      }
    });

    return () => {
      void supabase.removeChannel(rt);
    };
  }, [supabase, campaignId, meId, refetchStructure]);

  /* ------------------------------ "visto por último" ao fechar/sair */
  useEffect(() => {
    const beacon = () => navigator.sendBeacon("/api/presence/offline");
    window.addEventListener("pagehide", beacon);
    return () => {
      window.removeEventListener("pagehide", beacon);
      beacon();
    };
  }, []);

  /* ------------------------------------------------------------ derivados */
  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.user_id, p])),
    [profiles],
  );
  const directoryByOwner = useMemo(
    () => new Map(directory.map((d) => [d.owner_user_id, d])),
    [directory],
  );
  const roleById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.role as MemberRole])),
    [members],
  );

  const metaOf = useCallback(
    (userId: string): ParticipantMeta => {
      const role = roleById.get(userId) ?? "player";
      if (role === "mestre") {
        return { id: userId, name: "Mestre", color: "#1a1712", initials: "M", role };
      }
      const entry = directoryByOwner.get(userId);
      const name = entry?.name ?? profileById.get(userId)?.display_name ?? "Agente";
      const color = COLORS[(entry?.archetype ?? "Intel") as Archetype];
      return { id: userId, name, color, initials: initialsOf(name), role };
    },
    [roleById, directoryByOwner, profileById],
  );

  const presenceLabel = useCallback(
    (userId: string) => {
      if (onlineIds.has(userId)) return "online";
      const lastSeen = profileById.get(userId)?.last_seen;
      if (!lastSeen) return "ainda não apareceu";
      return `visto por último às ${new Date(lastSeen).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    },
    [onlineIds, profileById],
  );

  const participantsByChannel = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of participants) {
      const list = map.get(p.channel_id);
      if (list) list.push(p.user_id);
      else map.set(p.channel_id, [p.user_id]);
    }
    return map;
  }, [participants]);

  const participantsOf = useCallback(
    (channelId: string) => participantsByChannel.get(channelId) ?? [],
    [participantsByChannel],
  );

  const messagesByChannel = useMemo(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const m of messages) {
      const list = map.get(m.channel_id);
      if (list) list.push(m);
      else map.set(m.channel_id, [m]);
    }
    return map;
  }, [messages]);

  const messagesOf = useCallback(
    (channelId: string) => messagesByChannel.get(channelId) ?? [],
    [messagesByChannel],
  );

  // O mestre recebe (por RLS) canais dos quais não participa: são as interceptações.
  const isIntercept = useCallback(
    (channel: ChatChannel) =>
      isGM && channel.type === "dm" && !participantsOf(channel.id).includes(meId),
    [isGM, participantsOf, meId],
  );

  const visibleChannels = useMemo(
    () =>
      [...channels].sort((a, b) => {
        if (a.type !== b.type) return a.type === "group" ? -1 : 1;
        return a.name.localeCompare(b.name, "pt-BR");
      }),
    [channels],
  );

  const readByChannel = useMemo(
    () => new Map(readPointers.map((r) => [r.channel_id, r.last_read_count])),
    [readPointers],
  );

  const unreadOf = useCallback(
    (channelId: string) =>
      Math.max(0, messagesOf(channelId).length - (readByChannel.get(channelId) ?? 0)),
    [messagesOf, readByChannel],
  );

  const totalUnread = useMemo(
    () => visibleChannels.reduce((sum, ch) => sum + unreadOf(ch.id), 0),
    [visibleChannels, unreadOf],
  );

  const myCharacter = useMemo(
    () => characters.find((c) => c.owner_user_id === meId) ?? null,
    [characters, meId],
  );

  const canEditCharacter = useCallback(
    (character: Character) => isGM || character.owner_user_id === meId,
    [isGM, meId],
  );

  const sharesByCharacter = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of shares) {
      const list = map.get(s.character_id);
      if (list) list.push(s.shared_with_user_id);
      else map.set(s.character_id, [s.shared_with_user_id]);
    }
    return map;
  }, [shares]);

  const sharedWith = useCallback(
    (characterId: string) => sharesByCharacter.get(characterId) ?? [],
    [sharesByCharacter],
  );

  /* ------------------------------------------------------------ mutações
     Padrão: aplica otimista, escreve, e deixa o Realtime confirmar. Erro de
     RLS volta como erro do supabase-js — nada é "aceito" só no client. */

  const patchCharacter = useCallback(
    async (id: string, patch: Partial<Character>) => {
      setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      const { error } = await supabase.from("characters").update(patch).eq("id", id);
      if (error) {
        console.error("patchCharacter", error);
        void refetchStructure();
      }
    },
    [supabase, refetchStructure],
  );

  const setShare = useCallback(
    async (characterId: string, userId: string, on: boolean) => {
      setShares((prev) =>
        on
          ? [...prev, { character_id: characterId, shared_with_user_id: userId }]
          : prev.filter(
              (s) => !(s.character_id === characterId && s.shared_with_user_id === userId),
            ),
      );
      const query = on
        ? supabase
            .from("character_shares")
            .insert({ character_id: characterId, shared_with_user_id: userId })
        : supabase
            .from("character_shares")
            .delete()
            .eq("character_id", characterId)
            .eq("shared_with_user_id", userId);
      const { error } = await query;
      if (error) {
        console.error("setShare", error);
        void refetchStructure();
      }
    },
    [supabase, refetchStructure],
  );

  const insertMessage = useCallback(
    async (channelId: string, type: "text" | "roll", body: unknown) => {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({ channel_id: channelId, sender_id: meId, type, body })
        .select()
        .single();
      if (error) {
        console.error("insertMessage", error);
        return;
      }
      setMessages((prev) =>
        prev.some((m) => m.id === data.id)
          ? prev
          : [...prev, data as ChatMessage].sort((a, b) =>
              a.created_at.localeCompare(b.created_at),
            ),
      );
    },
    [supabase, meId],
  );

  const sendText = useCallback(
    async (channelId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      await insertMessage(channelId, "text", { text: trimmed });
    },
    [insertMessage],
  );

  const sendRoll = useCallback(
    async (channelId: string, roll: RollMessageBody) => {
      await insertMessage(channelId, "roll", roll);
    },
    [insertMessage],
  );

  const broadcast = useCallback(
    async (text: string) => {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, text }),
      });
      if (res.ok) return null;
      const json = await res.json().catch(() => ({}));
      return json.error ?? "Não foi possível transmitir.";
    },
    [campaignId],
  );

  const markRead = useCallback(
    (channelId: string) => {
      const count = messagesOf(channelId).length;
      setReadPointers((prev) => {
        const existing = prev.find((r) => r.channel_id === channelId);
        if (existing?.last_read_count === count) return prev;
        return existing
          ? prev.map((r) =>
              r.channel_id === channelId ? { ...r, last_read_count: count } : r,
            )
          : [...prev, { channel_id: channelId, user_id: meId, last_read_count: count }];
      });
      void supabase
        .from("read_pointers")
        .upsert(
          { channel_id: channelId, user_id: meId, last_read_count: count },
          { onConflict: "channel_id,user_id" },
        )
        .then(({ error }) => {
          if (error) console.error("markRead", error);
        });
    },
    [supabase, meId, messagesOf],
  );

  const patchCampaign = useCallback(
    async (patch: Partial<Campaign>) => {
      setCampaign((prev) => ({ ...prev, ...patch }));
      const { error } = await supabase.from("campaigns").update(patch).eq("id", campaignId);
      if (error) console.error("patchCampaign", error);
    },
    [supabase, campaignId],
  );

  const addCard = useCallback(
    async (title: string, text: string) => {
      const { data, error } = await supabase
        .from("evidence_cards")
        .insert({
          campaign_id: campaignId,
          title: title.trim() || "Sem título",
          text: text.trim(),
          x: 80 + Math.random() * 300,
          y: 60 + Math.random() * 250,
        })
        .select()
        .single();
      if (error) {
        console.error("addCard", error);
        return;
      }
      setCards((prev) => upsertById(prev, data as EvidenceCard));
    },
    [supabase, campaignId],
  );

  // Arrastar dispara muito evento: pinta local sempre, persiste com debounce.
  const moveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const moveCard = useCallback(
    (id: string, x: number, y: number) => {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)));
      const timers = moveTimers.current;
      clearTimeout(timers.get(id));
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          // O builder do postgrest só dispara o fetch dentro do `.then()` —
          // sem ele a posição nunca chegava no banco (e nem no Realtime).
          void supabase
            .from("evidence_cards")
            .update({ x, y })
            .eq("id", id)
            .then(({ error }) => {
              if (error) console.error("moveCard", error);
            });
        }, 220),
      );
    },
    [supabase],
  );

  const removeCard = useCallback(
    async (id: string) => {
      setCards((prev) => prev.filter((c) => c.id !== id));
      setLinks((prev) => prev.filter((l) => l.card_a_id !== id && l.card_b_id !== id));
      const { error } = await supabase.from("evidence_cards").delete().eq("id", id);
      if (error) console.error("removeCard", error);
    },
    [supabase],
  );

  const addLink = useCallback(
    async (a: string, b: string) => {
      const { data, error } = await supabase
        .from("evidence_links")
        .insert({ campaign_id: campaignId, card_a_id: a, card_b_id: b })
        .select()
        .single();
      if (error) {
        console.error("addLink", error);
        return;
      }
      setLinks((prev) => upsertById(prev, data as EvidenceLink));
    },
    [supabase, campaignId],
  );

  const removeLink = useCallback(
    async (a: string, b: string) => {
      const target = links.find(
        (l) =>
          (l.card_a_id === a && l.card_b_id === b) || (l.card_a_id === b && l.card_b_id === a),
      );
      if (!target) return;
      setLinks((prev) => prev.filter((l) => l.id !== target.id));
      const { error } = await supabase.from("evidence_links").delete().eq("id", target.id);
      if (error) console.error("removeLink", error);
    },
    [supabase, links],
  );

  const value: CampaignContextValue = {
    meId,
    myRole,
    isGM,
    campaign,
    members,
    directory,
    characters,
    shares,
    channels,
    participants,
    cards,
    links,
    onlineIds,
    myCharacter,
    visibleChannels,
    participantsOf,
    metaOf,
    presenceLabel,
    messagesOf,
    isIntercept,
    canEditCharacter,
    sharedWith,
    unreadOf,
    totalUnread,
    patchCharacter,
    setShare,
    sendText,
    sendRoll,
    broadcast,
    markRead,
    patchCampaign,
    addCard,
    moveCard,
    removeCard,
    addLink,
    removeLink,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export type { Profile, ReadPointer };
