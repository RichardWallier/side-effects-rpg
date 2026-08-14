"use client";

import { useRef, useState } from "react";
import { useCampaign } from "@/lib/campaign/CampaignProvider";
import { uiScale } from "@/lib/ui/scale";
import type { EvidenceCard } from "@/lib/game/types";

/* O banco guarda x/y do cartão na base de 16px, e o mural em rem cresce junto
   com --ui-scale. Então tudo que vai pra tela é multiplicado pela escala, e o
   arrasto (que chega em px reais) é dividido de volta antes de salvar. Assim as
   posições já gravadas continuam valendo qualquer que seja a escala. */

/** Centro do alfinete relativo ao canto do cartão, na mesma base. */
const PIN_OFFSET = 15;

interface TempLine {
  fromId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function BoardWindow() {
  const { isGM, cards, links, addCard, moveCard, removeCard, addLink, removeLink } = useCampaign();

  const innerRef = useRef<HTMLDivElement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [temp, setTemp] = useState<TempLine | null>(null);

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const scale = uiScale();
  /** Ponta da linha que sai do alfinete, já em px de tela. */
  const pin = (card: EvidenceCard) => ({
    x: (card.x + PIN_OFFSET) * scale,
    y: (card.y + PIN_OFFSET) * scale,
  });

  function toInner(clientX: number, clientY: number) {
    const rect = innerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  /* -------------------------------------------------- arrastar o cartão */
  function startCardDrag(e: React.PointerEvent, card: EvidenceCard) {
    if (!isGM) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = card.x;
    const originY = card.y;

    const move = (ev: PointerEvent) => {
      moveCard(
        card.id,
        originX + (ev.clientX - startX) / scale,
        originY + (ev.clientY - startY) / scale,
      );
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  /* ------------------------- arrastar do alfinete = puxar linha até outro */
  function startPinDrag(e: React.PointerEvent, card: EvidenceCard) {
    if (!isGM) return;
    e.stopPropagation();
    e.preventDefault();

    const origin = pin(card);
    setTemp({ fromId: card.id, x1: origin.x, y1: origin.y, x2: origin.x, y2: origin.y });

    const move = (ev: PointerEvent) => {
      const point = toInner(ev.clientX, ev.clientY);
      setTemp((prev) => (prev ? { ...prev, x2: point.x, y2: point.y } : prev));
    };

    const up = (ev: PointerEvent) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      setTemp(null);

      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const pin = target?.closest?.(".evid-pin") as HTMLElement | null;
      const toId = pin?.dataset.id;
      if (!toId || toId === card.id) return;

      const exists = links.some(
        (l) =>
          (l.card_a_id === card.id && l.card_b_id === toId) ||
          (l.card_a_id === toId && l.card_b_id === card.id),
      );
      if (!exists) void addLink(card.id, toId);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  function submitCard() {
    void addCard(title, text);
    setTitle("");
    setText("");
    setFormOpen(false);
  }

  return (
    <>
      {isGM ? (
        <>
          <div className="board-toolbar">
            <button onClick={() => setFormOpen((v) => !v)}>📌 Novo cartão</button>
            <span className="board-hint">
              Arraste o card pra mover · arraste a agulha até outra agulha pra ligar · clique na
              linha pra desfazer.
            </span>
          </div>
          <div className={`new-card-form ${formOpen ? "open" : ""}`}>
            <input
              type="text"
              placeholder="Título (ex: nome, local, objeto)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              rows={2}
              placeholder="Anotação..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button onClick={submitCard} style={{ alignSelf: "flex-start" }}>
              Fixar no mural
            </button>
          </div>
        </>
      ) : (
        <div className="readonly-badge">🔒 Somente o mestre edita o mural</div>
      )}

      <div className="cork-board">
        <div className="cork-inner" ref={innerRef}>
          <svg className="cork-svg">
            {links.map((l) => {
              const a = cardById.get(l.card_a_id);
              const b = cardById.get(l.card_b_id);
              if (!a || !b) return null;
              const from = pin(a);
              const to = pin(b);
              const coords = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
              return (
                <g key={l.id}>
                  {isGM && (
                    <line
                      className="link-hit"
                      {...coords}
                      stroke="transparent"
                      strokeWidth={16 * scale}
                      onClick={() => void removeLink(l.card_a_id, l.card_b_id)}
                    />
                  )}
                  <line
                    {...coords}
                    stroke="#a33"
                    strokeWidth={2 * scale}
                    opacity={0.75}
                    style={{ pointerEvents: "none" }}
                  />
                </g>
              );
            })}
            {temp && (
              <line
                x1={temp.x1}
                y1={temp.y1}
                x2={temp.x2}
                y2={temp.y2}
                stroke="#a33"
                strokeWidth={2 * scale}
                strokeDasharray={`${6 * scale},${4 * scale}`}
                opacity={0.85}
              />
            )}
          </svg>

          {cards.map((card) => (
            <div
              key={card.id}
              className={`evid-card ${isGM ? "" : "readonly"}`}
              style={{
                left: card.x * scale,
                top: card.y * scale,
                touchAction: isGM ? "none" : undefined,
              }}
              onPointerDown={(e) => startCardDrag(e, card)}
            >
              <div
                className="evid-pin"
                data-id={card.id}
                onPointerDown={(e) => startPinDrag(e, card)}
              />
              {isGM && (
                <button
                  className="evid-del"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => void removeCard(card.id)}
                >
                  ✕
                </button>
              )}
              <div className="evid-title">{card.title}</div>
              <div className="evid-text">{card.text}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
