"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCampaign } from "@/lib/campaign/CampaignProvider";
import { isRollBody, textOf, type ChatChannel, type ChatMessage } from "@/lib/game/types";
import { RollPanel } from "./RollPanel";

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function previewOf(message: ChatMessage | undefined): string {
  if (!message) return "Sem mensagens ainda";
  if (isRollBody(message)) return `🎲 ${message.body.roller} rolou ${message.body.total}`;
  const text = textOf(message);
  if (message.type === "narration") {
    return `📢 Narração: ${text.length > 28 ? `${text.slice(0, 28)}…` : text}`;
  }
  return text.length > 34 ? `${text.slice(0, 34)}…` : text;
}

export function ChatWindow() {
  const { isGM, visibleChannels, isIntercept, messagesOf, markRead } = useCampaign();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileConvo, setMobileConvo] = useState(false);

  const active = visibleChannels.find((c) => c.id === activeId) ?? null;
  const activeCount = active ? messagesOf(active.id).length : 0;

  // Com a conversa aberta, o que chega já entra como lido.
  useEffect(() => {
    if (activeId) markRead(activeId);
  }, [activeId, activeCount, markRead]);

  const { mine, intercepts } = useMemo(() => {
    if (!isGM) return { mine: visibleChannels, intercepts: [] as ChatChannel[] };
    return {
      mine: visibleChannels.filter((c) => !isIntercept(c)),
      intercepts: visibleChannels.filter((c) => isIntercept(c)),
    };
  }, [isGM, visibleChannels, isIntercept]);

  const openChannel = (id: string) => {
    setActiveId(id);
    setMobileConvo(true);
    markRead(id);
  };

  return (
    <div className={`wa-wrap ${mobileConvo ? "mode-convo" : ""}`}>
      <div className="wa-list-pane">
        <div className="wa-section-label">Conversas</div>
        {mine.map((c) => (
          <ChannelRow key={c.id} channel={c} activeId={activeId} onOpen={openChannel} />
        ))}

        {isGM && (
          <>
            <div className="wa-section-label intercept">🔴 Interceptações (leitura)</div>
            {intercepts.length > 0 ? (
              intercepts.map((c) => (
                <ChannelRow key={c.id} channel={c} activeId={activeId} onOpen={openChannel} />
              ))
            ) : (
              <div className="wa-item-preview" style={{ padding: "0 12px 10px" }}>
                Nenhuma conversa privada entre jogadores ainda.
              </div>
            )}
          </>
        )}
      </div>

      <div className="wa-convo-pane">
        {active ? (
          // key por canal: trocar de conversa zera rascunho e painel de rolagem.
          <Conversation key={active.id} channel={active} onBack={() => setMobileConvo(false)} />
        ) : (
          <div className="wa-empty">Selecione uma conversa à esquerda</div>
        )}
      </div>
    </div>
  );
}

function ChannelRow({
  channel,
  activeId,
  onOpen,
}: {
  channel: ChatChannel;
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const { meId, participantsOf, isIntercept, messagesOf, metaOf, onlineIds, unreadOf } =
    useCampaign();

  const messages = messagesOf(channel.id);
  const last = messages[messages.length - 1];
  const intercept = isIntercept(channel);
  const unread = unreadOf(channel.id);
  const members = participantsOf(channel.id);

  let avatar: React.ReactNode;
  let title: string;

  if (channel.type === "group") {
    avatar = (
      <div className="wa-avatar-wrap">
        <div className="wa-avatar" style={{ background: "#5c5340" }}>
          👥
        </div>
      </div>
    );
    title = channel.name;
  } else {
    const otherId = members.find((p) => p !== meId) ?? members[0] ?? meId;
    const meta = metaOf(otherId);
    avatar = (
      <div className="wa-avatar-wrap">
        <div className="wa-avatar" style={{ background: meta.color }}>
          {meta.initials}
        </div>
        <span className={`presence-dot ${onlineIds.has(otherId) ? "online" : ""}`} />
      </div>
    );
    title = intercept ? channel.name : meta.name;
  }

  return (
    <button
      className={`wa-item ${intercept ? "wa-item-intercept" : ""} ${
        channel.id === activeId ? "active" : ""
      }`}
      onClick={() => onOpen(channel.id)}
    >
      {avatar}
      <div className="wa-item-body">
        <div className="wa-item-top">
          <span className={`wa-item-name ${unread > 0 ? "unread" : ""}`}>{title}</span>
          <span className="wa-item-time">{last ? hhmm(last.created_at) : ""}</span>
        </div>
        <div
          className="wa-item-preview"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}
        >
          <span>
            {intercept && <span className="wa-item-tag">🔴 grampo · </span>}
            {previewOf(last)}
          </span>
          {unread > 0 && <span className="wa-badge-count">{unread}</span>}
        </div>
      </div>
    </button>
  );
}

function Conversation({ channel, onBack }: { channel: ChatChannel; onBack: () => void }) {
  const { meId, participantsOf, isIntercept, messagesOf, metaOf, presenceLabel, onlineIds, sendText } =
    useCampaign();

  const [draft, setDraft] = useState("");
  const [rollOpen, setRollOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const messages = messagesOf(channel.id);
  const intercept = isIntercept(channel);
  const members = participantsOf(channel.id);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Abrir a conversa já deixa o cursor na caixa de escrita. Só no desktop —
  // no mobile isso subiria o teclado virtual em cima da conversa.
  // Este componente tem `key` por canal, então remonta a cada troca.
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) return;
    inputRef.current?.focus();
  }, []);

  let headerTitle: string;
  let headerSub = "";
  let avatar: React.ReactNode;

  if (channel.type === "group") {
    headerTitle = "Sala do Grupo";
    headerSub = `${members.filter((id) => onlineIds.has(id)).length} online agora`;
    avatar = (
      <div className="wa-avatar small" style={{ background: "#ffffff33" }}>
        👥
      </div>
    );
  } else {
    const otherId = members.find((p) => p !== meId) ?? members[0] ?? meId;
    const meta = metaOf(otherId);
    avatar = (
      <div className="wa-avatar small" style={{ background: meta.color }}>
        {meta.initials}
      </div>
    );
    if (intercept) {
      headerTitle = channel.name;
      headerSub = members.map((id) => `${metaOf(id).name}: ${presenceLabel(id)}`).join(" · ");
    } else {
      headerTitle = meta.name;
      headerSub = presenceLabel(otherId);
    }
  }

  async function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await sendText(channel.id, text);
  }

  return (
    <>
      <div className={`wa-convo-header ${intercept ? "intercept" : ""}`}>
        <button className="wa-back" onClick={onBack} aria-label="Voltar">
          ←
        </button>
        {avatar}
        <div>
          <div className="wa-convo-title">{headerTitle}</div>
          {headerSub && <div className="wa-convo-sub">{headerSub}</div>}
        </div>
      </div>

      {intercept && (
        <div className="wa-surveil-banner">
          🔴 MODO VIGILÂNCIA — conversa privada entre jogadores, leitura apenas
        </div>
      )}

      <div className={`wa-msgs ${intercept ? "intercept" : ""}`} ref={scrollRef}>
        {messages.length === 0 && <div className="wa-empty">Sem mensagens ainda.</div>}
        {messages.map((m) => (
          <MessageView key={m.id} message={m} channel={channel} intercept={intercept} />
        ))}
      </div>

      {/* Interceptação não tem caixa de escrita: o INSERT seria recusado pela RLS
          de qualquer jeito, então nem oferecemos o campo. */}
      {!intercept && (
        <>
          {rollOpen && <RollPanel channelId={channel.id} onDone={() => setRollOpen(false)} />}
          <div className="wa-input-row">
            <button
              className="wa-dice-btn"
              title="Rolar dado"
              onClick={() => setRollOpen((v) => !v)}
            >
              🎲
            </button>
            <input
              ref={inputRef}
              type="text"
              placeholder="Escrever mensagem..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
            <button onClick={() => void submit()}>Enviar</button>
          </div>
        </>
      )}
    </>
  );
}

function MessageView({
  message,
  channel,
  intercept,
}: {
  message: ChatMessage;
  channel: ChatChannel;
  intercept: boolean;
}) {
  const { meId, metaOf, participantsOf } = useCampaign();

  if (isRollBody(message)) {
    const { roller, d20, parts, total, difficulty } = message.body;
    const mods = parts
      .map((p) => `${p.value >= 0 ? " + " : " − "}${Math.abs(p.value)}`)
      .join("");
    const ok = difficulty != null && total >= difficulty;
    return (
      <div className="wa-roll-card">
        <div className="wa-roll-title">🎲 {roller} rolou</div>
        <div className="wa-roll-total">
          {d20}
          {mods} = {total}
        </div>
        <div className="wa-roll-breakdown">
          {parts.map((p) => `${p.label} ${p.value >= 0 ? "+" : ""}${p.value}`).join(" · ")}
        </div>
        {difficulty != null && (
          <div className={`wa-roll-badge ${ok ? "success" : "fail"}`}>
            {ok ? "SUCESSO" : "FALHA"} vs dificuldade {difficulty}
          </div>
        )}
        <div className="wa-bubble-time" style={{ textAlign: "center", marginTop: 4 }}>
          {hhmm(message.created_at)}
        </div>
      </div>
    );
  }

  if (message.type === "narration") {
    return (
      <div className="wa-narration-card">
        <div className="wa-narration-title">📢 Narração do Mestre</div>
        <div className="wa-narration-text">{textOf(message)}</div>
        <div
          className="wa-bubble-time"
          style={{ textAlign: "center", color: "#ffffff77", marginTop: 6 }}
        >
          {hhmm(message.created_at)}
        </div>
      </div>
    );
  }

  const meta = metaOf(message.sender_id);
  // Numa interceptação nenhuma das pontas é "eu": ancora no primeiro participante.
  const side = intercept
    ? participantsOf(channel.id)[0] === message.sender_id
      ? "out"
      : "in"
    : message.sender_id === meId
      ? "out"
      : "in";
  const showSender = channel.type === "group" || intercept;

  return (
    <div className={`wa-bubble ${side} ${intercept ? "intercepted" : ""}`}>
      {showSender && (
        <div className="wa-bubble-sender" style={{ color: meta.color }}>
          {meta.name}
        </div>
      )}
      {textOf(message)}
      <div className="wa-bubble-time">{hhmm(message.created_at)}</div>
    </div>
  );
}
