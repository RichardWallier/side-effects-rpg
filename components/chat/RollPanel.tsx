"use client";

import { useEffect, useRef, useState } from "react";
import { useCampaign } from "@/lib/campaign/CampaignProvider";
import {
  ATTR_LIST,
  DIE_SIDES,
  MAX_DICE_COUNT,
  MIN_DICE_COUNT,
  SKILL_CATS,
  attrMod,
  rollDice,
  signed,
  type Archetype,
  type DieSides,
} from "@/lib/game/rules";
import type { RollPart } from "@/lib/game/types";

const ROLL_ANIMATION_MS = 3000;

export function RollPanel({ channelId, onDone }: { channelId: string; onDone: () => void }) {
  const { isGM, myCharacter, characters, sendRoll } = useCampaign();

  // Mestre escolhe rolar como um personagem ou "manual/NPC"; jogador usa a própria ficha.
  const [rollAsId, setRollAsId] = useState("");
  const character = isGM ? characters.find((c) => c.id === rollAsId) ?? null : myCharacter;

  const [attr, setAttr] = useState<string>(ATTR_LIST[0]);
  const [skill, setSkill] = useState<string>(SKILL_CATS.Hard[0]);
  const [desc, setDesc] = useState("");
  const [manualMod, setManualMod] = useState("0");
  const [withKarma, setWithKarma] = useState(true);
  const [difficulty, setDifficulty] = useState("");
  const [dieSides, setDieSides] = useState<DieSides>(20);
  const [dieCount, setDieCount] = useState(1);

  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<number[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const karmaValue = character?.karma ?? 0;

  function finalize() {
    const parts: RollPart[] = [];

    if (character) {
      parts.push({ label: attr, value: attrMod(character.attrs[attr] ?? 3) });
      parts.push({ label: skill, value: character.skills[skill] ?? 0 });
      if (withKarma) parts.push({ label: "Karma", value: character.karma });
    } else {
      parts.push({
        label: desc.trim() || "Teste",
        value: Number.parseInt(manualMod, 10) || 0,
      });
      if (withKarma) parts.push({ label: "Karma", value: 0 });
    }

    const dieResults = rollDice(dieSides, dieCount);
    const dieResult = dieResults.reduce((sum, v) => sum + v, 0);
    const total = dieResult + parts.reduce((sum, p) => sum + p.value, 0);
    const roller = character
      ? character.name + (isGM ? " (via Mestre)" : "")
      : "Mestre";

    void sendRoll(channelId, {
      roller,
      dieSides,
      dieCount,
      dieResults,
      dieResult,
      parts,
      total,
      difficulty: difficulty ? Number.parseInt(difficulty, 10) : null,
    });

    setRolling(false);
    setFace(null);
    onDone();
  }

  // Números correndo por ~3s, desacelerando no fim — mesma curva do protótipo.
  function performRoll() {
    if (rolling) return;
    setRolling(true);

    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      if (elapsed >= ROLL_ANIMATION_MS) {
        finalize();
        return;
      }
      setFace(rollDice(dieSides, dieCount));
      const progress = elapsed / ROLL_ANIMATION_MS;
      timers.current.push(setTimeout(tick, 40 + progress * progress * 320));
    };
    tick();
  }

  return (
    <div className="roll-panel" style={{ display: "flex" }}>
      {isGM && (
        <div className="roll-row">
          <select value={rollAsId} onChange={(e) => setRollAsId(e.target.value)}>
            <option value="">— manual / NPC —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {character ? (
        <div className="roll-row">
          <select value={attr} onChange={(e) => setAttr(e.target.value)}>
            {ATTR_LIST.map((a) => (
              <option key={a} value={a}>
                {a} ({signed(attrMod(character.attrs[a] ?? 3))})
              </option>
            ))}
          </select>
          <select value={skill} onChange={(e) => setSkill(e.target.value)}>
            {(Object.keys(SKILL_CATS) as Archetype[]).map((cat) => (
              <optgroup key={cat} label={cat}>
                {SKILL_CATS[cat].map((s) => (
                  <option key={s} value={s}>
                    {s} ({signed(character.skills[s] ?? 0)})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div className="roll-row">
            <input
              type="text"
              placeholder="O que está sendo testado (ex: Percepção do guarda)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div className="roll-row">
            <input
              type="number"
              placeholder="Modificador"
              value={manualMod}
              onChange={(e) => setManualMod(e.target.value)}
            />
          </div>
        </>
      )}

      <div className="roll-row">
        <div className="dice-count" role="group" aria-label="Quantidade de dados">
          <button
            type="button"
            className="die-count-btn"
            disabled={rolling || dieCount <= MIN_DICE_COUNT}
            onClick={() => setDieCount((n) => Math.max(MIN_DICE_COUNT, n - 1))}
          >
            −
          </button>
          <span className="die-count-val">{dieCount}</span>
          <button
            type="button"
            className="die-count-btn"
            disabled={rolling || dieCount >= MAX_DICE_COUNT}
            onClick={() => setDieCount((n) => Math.min(MAX_DICE_COUNT, n + 1))}
          >
            +
          </button>
        </div>
        <div className="die-select" role="group" aria-label="Tipo de dado">
          {DIE_SIDES.map((sides) => (
            <button
              key={sides}
              type="button"
              className={`die-btn ${dieSides === sides ? "active" : ""}`}
              disabled={rolling}
              onClick={() => setDieSides(sides)}
            >
              d{sides}
            </button>
          ))}
        </div>
      </div>

      <div className="roll-row">
        <label className="roll-check">
          <input
            type="checkbox"
            checked={withKarma}
            onChange={(e) => setWithKarma(e.target.checked)}
          />{" "}
          Incluir Karma ({signed(karmaValue)})
        </label>
        <input
          type="number"
          placeholder="Dificuldade (opcional)"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        />
      </div>

      <button
        className={`roll-go-btn ${rolling ? "rolling" : ""}`}
        disabled={rolling}
        onClick={performRoll}
      >
        {rolling && face != null
          ? `🎲 ${face.reduce((sum, v) => sum + v, 0)}`
          : `🎲 Rolar ${dieCount > 1 ? `${dieCount}d${dieSides}` : `d${dieSides}`}`}
      </button>
    </div>
  );
}
