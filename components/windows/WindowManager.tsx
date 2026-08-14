"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { scaled } from "@/lib/ui/scale";

interface OpenWindow {
  key: string;
  title: string;
  node: React.ReactNode;
  /** Ordem de empilhamento. Focar/reabrir sobe pro topo. */
  z: number;
  /** Degrau da escada de abertura; vira `--cascade-i` no CSS. */
  cascade: number;
}

/** Retângulo em px assumido depois do primeiro arraste/resize daquela janela. */
interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

type ResizeEdge = "e" | "s" | "se";

interface WindowsApi {
  /** Reabrir a mesma `key` traz a janela pro topo em vez de duplicar. */
  open: (key: string, title: string, node: React.ReactNode) => void;
  close: (key: string) => void;
  isOpen: (key: string) => boolean;
}

const Ctx = createContext<WindowsApi | null>(null);

export function useWindows() {
  const api = useContext(Ctx);
  if (!api) throw new Error("useWindows fora de <WindowManager>");
  return api;
}

/** Mesmo breakpoint do globals.css, onde a janela vira tela cheia. */
const MOBILE = "(max-width: 1140px)";

/* Medidas na base de 16px: `scaled()` traduz pra px reais, senão elas
   encolheriam em relação à janela quando a escala da UI sobe. */
const MIN_W = 320;
const MIN_H = 180;
/** Quanto da janela precisa continuar alcançável ao arrastar pra fora. */
const KEEP_VISIBLE = 90;
const BAR_H = 36;

/** Quantos degraus a escada de abertura percorre antes de repetir. */
const CASCADE_SLOTS = 5;

const isMobile = () => window.matchMedia(MOBILE).matches;

const topZ = (list: OpenWindow[]) => list.reduce((max, w) => Math.max(max, w.z), 0);

/** Menor degrau livre: duas janelas abertas nunca coincidem, e fechar uma
 *  devolve o degrau pro próximo `open` em vez de empurrar a escada pra baixo. */
function freeCascade(list: OpenWindow[]): number {
  const taken = new Set(list.map((w) => w.cascade));
  for (let i = 0; i < CASCADE_SLOTS; i++) if (!taken.has(i)) return i;
  return list.length % CASCADE_SLOTS;
}

function clampPos(x: number, y: number, w: number): { x: number; y: number } {
  const keep = scaled(KEEP_VISIBLE);
  return {
    x: Math.min(Math.max(x, keep - w), window.innerWidth - keep),
    y: Math.min(Math.max(y, 0), window.innerHeight - scaled(BAR_H)),
  };
}

export function WindowManager({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [frames, setFrames] = useState<Record<string, Frame>>({});

  const open = useCallback((key: string, title: string, node: React.ReactNode) => {
    setWindows((prev) => {
      const current = prev.find((w) => w.key === key);
      // Reabrir não remexe a janela de lugar: só sobe pro topo.
      const cascade = current ? current.cascade : freeCascade(prev);
      const next = { key, title, node, z: topZ(prev) + 1, cascade };
      return current ? prev.map((w) => (w.key === key ? next : w)) : [...prev, next];
    });
  }, []);

  const close = useCallback((key: string) => {
    setWindows((prev) => prev.filter((w) => w.key !== key));
    setFrames((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const focus = useCallback((key: string) => {
    setWindows((prev) => {
      const current = prev.find((w) => w.key === key);
      if (!current || current.z === topZ(prev)) return prev;
      const z = topZ(prev) + 1;
      return prev.map((w) => (w.key === key ? { ...w, z } : w));
    });
  }, []);

  /* No mobile a janela é tela cheia por CSS — um frame inline brigaria com a
     media query, então descarta o que foi arrastado no desktop. */
  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const sync = () => {
      if (mq.matches) setFrames({});
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* Redimensionar o browser pode deixar a janela fora da tela. */
  useEffect(() => {
    const onResize = () => {
      if (isMobile()) return;
      setFrames((prev) => {
        const next: Record<string, Frame> = {};
        for (const [key, f] of Object.entries(prev)) {
          const w = Math.min(f.w, window.innerWidth);
          next[key] = { ...f, w, ...clampPos(f.x, f.y, w) };
        }
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /** Congela o retângulo atual do CSS pra poder mexer em px a partir dele. */
  const freeze = useCallback((key: string, el: HTMLElement): Frame => {
    const rect = el.getBoundingClientRect();
    const frame = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    setFrames((prev) => (prev[key] ? prev : { ...prev, [key]: frame }));
    return frame;
  }, []);

  /**
   * Arrastar e redimensionar compartilham o mesmo laço: captura o ponteiro no
   * elemento da alça e traduz o delta em posição ou tamanho.
   */
  const startGesture = useCallback(
    (e: React.PointerEvent, key: string, edge: ResizeEdge | null) => {
      if (e.button !== 0 || isMobile()) return;
      const handle = e.currentTarget as HTMLElement;
      const win = handle.closest(".win") as HTMLElement | null;
      if (!win) return;

      e.preventDefault();
      focus(key);
      const start = freeze(key, win);
      const startX = e.clientX;
      const startY = e.clientY;
      handle.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        setFrames((prev) => {
          const base = prev[key] ?? start;
          if (!edge) {
            return { ...prev, [key]: { ...base, ...clampPos(start.x + dx, start.y + dy, base.w) } };
          }
          const w =
            edge === "s"
              ? base.w
              : Math.max(scaled(MIN_W), Math.min(start.w + dx, window.innerWidth - start.x));
          const h =
            edge === "e"
              ? base.h
              : Math.max(scaled(MIN_H), Math.min(start.h + dy, window.innerHeight - start.y));
          return { ...prev, [key]: { ...base, w, h } };
        });
      };

      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        document.body.classList.remove("win-dragging");
      };

      document.body.classList.add("win-dragging");
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    },
    [focus, freeze],
  );

  const api = useMemo<WindowsApi>(
    () => ({ open, close, isOpen: (key) => windows.some((w) => w.key === key) }),
    [open, close, windows],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="windows-layer">
        {windows.map((w) => {
          const f = frames[w.key];
          return (
            <div
              className={`win ${f ? "sized" : ""}`}
              key={w.key}
              style={
                f
                  ? {
                      zIndex: w.z,
                      left: f.x,
                      top: f.y,
                      width: f.w,
                      height: f.h,
                      maxHeight: "none",
                      transform: "none",
                    }
                  : ({ zIndex: w.z, "--cascade-i": w.cascade } as React.CSSProperties)
              }
              onPointerDown={() => focus(w.key)}
            >
              <div
                className="win-bar"
                onPointerDown={(e) => {
                  // O ✕ vive dentro da barra: clicar nele não arrasta.
                  if ((e.target as HTMLElement).closest("button")) return;
                  startGesture(e, w.key, null);
                }}
              >
                <div className="win-title">📁 {w.title}</div>
                <button
                  className="win-close"
                  onClick={() => close(w.key)}
                  aria-label="Fechar janela"
                >
                  ✕
                </button>
              </div>
              <div className="win-body">{w.node}</div>
              <div className="win-resize e" onPointerDown={(e) => startGesture(e, w.key, "e")} />
              <div className="win-resize s" onPointerDown={(e) => startGesture(e, w.key, "s")} />
              <div className="win-resize se" onPointerDown={(e) => startGesture(e, w.key, "se")} />
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
