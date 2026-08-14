"use client";

import { useEffect, useState } from "react";
import { useCampaign } from "@/lib/campaign/CampaignProvider";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { CommitField } from "./CommitField";
import {
  ATTR_LIST,
  COLORS,
  SKILL_CATS,
  WOUND_STEPS,
  attrMod,
  karmaTierClass,
  karmaTierName,
  nextSkillLevel,
  signed,
  type Archetype,
} from "@/lib/game/rules";

export function DossieWindow({ characterId }: { characterId: string }) {
  const {
    characters,
    members,
    meId,
    metaOf,
    canEditCharacter,
    sharedWith,
    patchCharacter,
    setShare,
  } = useCampaign();

  const character = characters.find((c) => c.id === characterId);

  // Karma tem slider: pinta na hora, grava no fim da rajada.
  const [karmaDraft, setKarmaDraft] = useState(character?.karma ?? 0);
  const persistKarma = useDebounced((karma: number) => patchCharacter(characterId, { karma }), 250);

  useEffect(() => {
    if (character) setKarmaDraft(character.karma);
  }, [character?.karma, character]);

  if (!character) {
    return <p className="form-note">Ficha indisponível.</p>;
  }

  const canEdit = canEditCharacter(character);
  const isOwner = character.owner_user_id === meId;
  const color = COLORS[character.archetype];
  const tierName = karmaTierName(karmaDraft);
  const shared = sharedWith(character.id);

  const otherPlayers = members.filter((m) => m.role === "player" && m.user_id !== meId);

  return (
    <div className={`dossie-wrap ${karmaTierClass(karmaDraft)}`}>
      <div className="stamp2">CONFIDENCIAL</div>

      <header className="top">
        <div>
          <div className="kicker">Efeitos Colaterais — Dossiê de Agente</div>
          <h1 className="sheetTitle">{character.name}</h1>
        </div>
        <div className="arche-tag" style={{ "--cat-color": color } as React.CSSProperties}>
          {character.archetype}
        </div>
      </header>

      {!canEdit && <div className="readonly-badge">Modo leitura — apenas visualização</div>}

      <div className="id-row">
        <div className="field">
          <label htmlFor="occupation">Ocupação</label>
          <CommitField
            id="occupation"
            value={character.occupation}
            disabled={!canEdit}
            onCommit={(occupation) => patchCharacter(character.id, { occupation })}
          />
        </div>
        <div className="field">
          <label>Karma inicial</label>
          <input value={tierName} disabled readOnly />
        </div>
        <div className="field" style={{ gridColumn: "1/-1" }}>
          <label htmlFor="hook">Gancho pessoal</label>
          <CommitField
            id="hook"
            rows={2}
            value={character.hook}
            disabled={!canEdit}
            onCommit={(hook) => patchCharacter(character.id, { hook })}
          />
        </div>
      </div>

      {isOwner && (
        <div className="panel share-panel">
          <h2>Compartilhar ficha com</h2>
          <label className="share-check">
            <input type="checkbox" checked disabled readOnly /> Mestre (obrigatório)
          </label>
          {otherPlayers.map((m) => (
            <label className="share-check" key={m.user_id}>
              <input
                type="checkbox"
                checked={shared.includes(m.user_id)}
                onChange={(e) => setShare(character.id, m.user_id, e.target.checked)}
              />{" "}
              {metaOf(m.user_id).name}
            </label>
          ))}
        </div>
      )}

      <div className="grid-main">
        <div className="panel">
          <h2>Atributos</h2>
          {ATTR_LIST.map((name) => {
            const value = character.attrs[name] ?? 3;
            return (
              <div className="attr" key={name}>
                <span className="attr-name">{name}</span>
                <input
                  className="attr-val"
                  type="number"
                  min={1}
                  max={10}
                  value={value}
                  disabled={!canEdit}
                  onChange={(e) =>
                    patchCharacter(character.id, {
                      attrs: {
                        ...character.attrs,
                        [name]: Number.parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                />
                <span className="attr-mod">{signed(attrMod(value))}</span>
              </div>
            );
          })}
          <div className="gauge-label" style={{ marginTop: 8 }}>
            Mod = valor − 3
          </div>
        </div>

        <div className="panel">
          <h2>Perícias</h2>
          {(Object.keys(SKILL_CATS) as Archetype[]).map((cat) => (
            <div className="skill-cat" key={cat}>
              <span className="skill-cat-title" style={{ background: COLORS[cat] }}>
                {cat}
              </span>
              {SKILL_CATS[cat].map((skill) => {
                const level = character.skills[skill] ?? 0;
                return (
                  <div className="skill-row" key={skill}>
                    <span>{skill}</span>
                    <div className="skill-toggle">
                      {([1, 2] as const).map((dotIndex) => (
                        <button
                          key={dotIndex}
                          type="button"
                          aria-label={`${skill} nível ${dotIndex}`}
                          className={`dot ${level >= dotIndex * 2 ? "on" : ""}`}
                          disabled={!canEdit}
                          onClick={() =>
                            patchCharacter(character.id, {
                              skills: {
                                ...character.skills,
                                [skill]: nextSkillLevel(level, dotIndex),
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="gauge-label">
            ● 1 clique = Treinado (+2) · 2 cliques = Especialista (+4)
          </div>
        </div>

        <div className="panel">
          <h2>Karma</h2>
          <div className="gauge-wrap">
            <div className="gauge-value">{signed(karmaDraft)}</div>
            <div className="gauge-tier">{tierName.toUpperCase()}</div>
            <input
              type="range"
              min={-5}
              max={5}
              value={karmaDraft}
              disabled={!canEdit}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10);
                setKarmaDraft(next);
                persistKarma(next);
              }}
            />
          </div>

          <h2 style={{ marginTop: 12 }}>Pool Ativo</h2>
          <div className="pool">
            {Array.from({ length: character.pool_max }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ponto de pool ${i + 1}`}
                className={`pool-box ${i < character.pool_spent ? "spent" : ""}`}
                disabled={!canEdit}
                onClick={() =>
                  patchCharacter(character.id, {
                    pool_spent: i < character.pool_spent ? i : i + 1,
                  })
                }
              />
            ))}
          </div>
          <div className="gauge-label">Recarrega em momentos-chave (decisão do mestre)</div>
        </div>
      </div>

      <div className="bottom-row">
        <div className="panel">
          <h2>Trilha de Ferimento</h2>
          <div className="wound-track">
            {WOUND_STEPS.map((step, i) => (
              <button
                key={step}
                type="button"
                className={`wound-step ${i === character.wound ? "current" : ""}`}
                disabled={!canEdit}
                onClick={() => patchCharacter(character.id, { wound: i })}
              >
                {step}
              </button>
            ))}
          </div>

          <h2 style={{ marginTop: 12 }}>Equipamento</h2>
          <div className="field">
            <CommitField
              rows={3}
              value={character.equip}
              disabled={!canEdit}
              onCommit={(equip) => patchCharacter(character.id, { equip })}
            />
          </div>
        </div>

        <div className="panel">
          <h2>Observações</h2>
          <div className="field">
            <CommitField
              rows={9}
              placeholder="Anotações livres..."
              value={character.notes}
              disabled={!canEdit}
              onCommit={(notes) => patchCharacter(character.id, { notes })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LockedDossieWindow({ name }: { name: string }) {
  return (
    <>
      <div className="readonly-badge">🔒 Sem acesso</div>
      <p style={{ fontSize: "13.5px", marginTop: 12, lineHeight: 1.6 }}>
        Você não tem acesso ao dossiê de <strong>{name}</strong>. Esse agente ainda não
        compartilhou a ficha com você. Peça pra ele liberar em “Compartilhar ficha com” na própria
        ficha dele.
      </p>
    </>
  );
}
