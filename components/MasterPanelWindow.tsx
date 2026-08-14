"use client";

import { useCampaign } from "@/lib/campaign/CampaignProvider";
import { COLORS, WOUND_STEPS, karmaTierName, signed } from "@/lib/game/rules";
import { ACTS } from "@/lib/game/rules";
import { CommitField } from "./CommitField";

export function MasterPanelWindow({ onOpenDossie }: { onOpenDossie: (id: string) => void }) {
  const { campaign, characters, patchCampaign } = useCampaign();

  return (
    <>
      <h1 className="sheetTitle" style={{ marginBottom: 14 }}>
        Painel do Mestre
      </h1>

      <div className="master-grid">
        {characters.map((c) => (
          <button
            key={c.id}
            className="mini-card"
            style={{ "--cat-color": COLORS[c.archetype] } as React.CSSProperties}
            onClick={() => onOpenDossie(c.id)}
          >
            <div className="mini-name">{c.name}</div>
            <div className="mini-occ">
              {c.archetype.toUpperCase()} · {c.occupation}
            </div>
            <div className="mini-row">
              <span>Karma</span>
              <span>
                {signed(c.karma)} ({karmaTierName(c.karma)})
              </span>
            </div>
            <div className="mini-row">
              <span>Pool ativo</span>
              <span>
                {c.pool_max - c.pool_spent}/{c.pool_max}
              </span>
            </div>
            <div className={`mini-wound w${c.wound}`}>{WOUND_STEPS[c.wound]}</div>
          </button>
        ))}
      </div>

      <div className="act-box">
        <h2 style={{ fontFamily: "'Special Elite', monospace", fontSize: 14, margin: "0 0 8px" }}>
          Ato Atual
        </h2>
        <select
          value={campaign.act}
          onChange={(e) => patchCampaign({ act: Number.parseInt(e.target.value, 10) })}
        >
          {ACTS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        <div className="field">
          <label>Sinopse (visível aos jogadores)</label>
          <CommitField
            rows={4}
            value={campaign.synopsis}
            onCommit={(synopsis) => patchCampaign({ synopsis })}
          />
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Notas de sessão (só mestre)</label>
          <CommitField
            rows={5}
            value={campaign.session_notes}
            onCommit={(session_notes) => patchCampaign({ session_notes })}
          />
        </div>
      </div>

      <div className="form-note">
        Código de convite desta mesa: <span className="invite-code">{campaign.invite_code}</span>
      </div>
    </>
  );
}

export function SynopsisWindow() {
  const { campaign } = useCampaign();
  return (
    <>
      <h1 className="sheetTitle" style={{ marginBottom: 6 }}>
        Ato {campaign.act}
      </h1>
      <div className="readonly-badge">Definido pelo mestre</div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Sinopse</label>
        <textarea rows={6} disabled value={campaign.synopsis} readOnly />
      </div>
    </>
  );
}
