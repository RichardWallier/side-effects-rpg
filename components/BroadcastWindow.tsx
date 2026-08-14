"use client";

import { useState } from "react";
import { useCampaign } from "@/lib/campaign/CampaignProvider";

export function BroadcastWindow({ onSent }: { onSent: () => void }) {
  const { broadcast } = useCampaign();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    const err = await broadcast(text);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setText("");
    onSent();
  }

  return (
    <>
      <p style={{ fontSize: "0.8125rem", color: "var(--ink-soft)", marginTop: 0 }}>
        Uma narração aparece pra todo mundo na Sala do Grupo, com destaque — use pra cortes de
        cena, eventos que afetam todo o grupo de uma vez.
      </p>
      <textarea
        className="broadcast-textarea"
        placeholder="Ex: A luz do laboratório pisca duas vezes e apaga. Vocês ouvem passos vindos do corredor..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="broadcast-send-btn" onClick={() => void send()} disabled={busy}>
        {busy ? "Transmitindo…" : "📢 Transmitir para o grupo"}
      </button>
      {error && <div className="login-error">{error}</div>}
    </>
  );
}
