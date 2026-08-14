"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ARCHETYPES, type Archetype } from "@/lib/game/rules";

interface CampaignRow {
  id: string;
  name: string;
  act: number;
  invite_code: string;
  role: "mestre" | "player";
}

export default function CampaignsClient({
  campaigns,
  displayName,
}: {
  campaigns: CampaignRow[];
  displayName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"entrar" | "criar">("entrar");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // entrar
  const [inviteCode, setInviteCode] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [archetype, setArchetype] = useState<Archetype>("Intel");

  // criar
  const [campaignName, setCampaignName] = useState("");

  async function post(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Algo deu errado.");
      return null;
    }
    return json;
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const json = await post("/api/campaigns/join", {
      inviteCode,
      characterName,
      occupation,
      archetype,
    });
    if (json?.campaign) router.push(`/c/${json.campaign.id}`);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const json = await post("/api/campaigns", { name: campaignName });
    if (json?.campaign) router.push(`/c/${json.campaign.id}`);
  }

  return (
    <div className="explorer-screen">
      <div className="taskbar">
        <div className="brand">
          <span className="dot" />
          EFEITOS COLATERAIS
        </div>
        <div className="who">
          <span>{displayName.toUpperCase()}</span>
          <form action="/auth/signout" method="post">
            <button className="logout-btn" type="submit">
              Sair
            </button>
          </form>
        </div>
      </div>

      <div className="paper-sheet">
        <div className="stamp2">ARQUIVO</div>
        <div className="kicker">Efeitos Colaterais</div>
        <h1 className="sheetTitle" style={{ marginBottom: "1.125rem" }}>
          Suas mesas
        </h1>

        {campaigns.length > 0 ? (
          <div className="campaign-list">
            {campaigns.map((c) => (
              <a key={c.id} className="campaign-row" href={`/c/${c.id}`}>
                <div>
                  <div className="campaign-row-name">{c.name}</div>
                  <div className="campaign-row-meta">
                    Ato {c.act} · {c.role === "mestre" ? "Mestre" : "Agente de campo"}
                  </div>
                </div>
                {c.role === "mestre" && (
                  <div className="campaign-row-meta">
                    convite <span className="invite-code">{c.invite_code}</span>
                  </div>
                )}
              </a>
            ))}
          </div>
        ) : (
          <p className="form-note" style={{ marginBottom: "1.375rem" }}>
            Você ainda não está em nenhuma mesa. Entre com um código de convite ou crie a sua.
          </p>
        )}

        <div className="tab-row">
          <button
            className={`tab-btn ${tab === "entrar" ? "active" : ""}`}
            onClick={() => setTab("entrar")}
          >
            Entrar com convite
          </button>
          <button
            className={`tab-btn ${tab === "criar" ? "active" : ""}`}
            onClick={() => setTab("criar")}
          >
            Criar mesa (mestre)
          </button>
        </div>

        {tab === "entrar" ? (
          <form onSubmit={join}>
            <div className="login-field">
              <label htmlFor="invite">Código de convite</label>
              <input
                id="invite"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                style={{ letterSpacing: "0.1875rem", fontFamily: "'IBM Plex Mono', monospace" }}
              />
            </div>
            <div className="login-field">
              <label htmlFor="charname">Nome do personagem</label>
              <input
                id="charname"
                required
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
              />
            </div>
            <div className="login-field">
              <label htmlFor="occupation">Ocupação</label>
              <input
                id="occupation"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
              />
            </div>
            <div className="login-field">
              <label htmlFor="archetype">Arquétipo</label>
              <select
                id="archetype"
                value={archetype}
                onChange={(e) => setArchetype(e.target.value as Archetype)}
              >
                {ARCHETYPES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <button className="login-btn" type="submit" disabled={busy}>
              {busy ? "Entrando…" : "Entrar na mesa"}
            </button>
          </form>
        ) : (
          <form onSubmit={create}>
            <div className="login-field">
              <label htmlFor="campname">Nome da mesa</label>
              <input
                id="campname"
                required
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
            <button className="login-btn" type="submit" disabled={busy}>
              {busy ? "Criando…" : "Criar mesa"}
            </button>
            <div className="login-hint">
              Você vira o mestre e recebe um código de convite pra passar pros jogadores.
            </div>
          </form>
        )}

        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}
