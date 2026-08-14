"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface OpenWindow {
  key: string;
  title: string;
  node: React.ReactNode;
}

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

export function WindowManager({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<OpenWindow[]>([]);

  const open = useCallback((key: string, title: string, node: React.ReactNode) => {
    setWindows((prev) => [...prev.filter((w) => w.key !== key), { key, title, node }]);
  }, []);

  const close = useCallback((key: string) => {
    setWindows((prev) => prev.filter((w) => w.key !== key));
  }, []);

  const api = useMemo<WindowsApi>(
    () => ({ open, close, isOpen: (key) => windows.some((w) => w.key === key) }),
    [open, close, windows],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="windows-layer">
        {windows.map((w) => (
          <div className="win" key={w.key}>
            <div className="win-bar">
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
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
