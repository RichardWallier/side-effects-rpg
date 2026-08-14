"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { parseWallpaperUrl } from "@/lib/wallpaper";

interface WallpaperApi {
  /** URL já validada, ou "" pro fundo padrão. */
  url: string;
  setUrl: (url: string) => void;
}

const Ctx = createContext<WallpaperApi | null>(null);

export function useWallpaper() {
  const api = useContext(Ctx);
  if (!api) throw new Error("useWallpaper fora de <WallpaperProvider>");
  return api;
}

const storageKey = (campaignId: string) => `ec:wallpaper:${campaignId}`;

/**
 * Enfeite por pessoa, não por mesa: mora no localStorage do navegador, uma
 * chave por campanha. Não passa pelo Supabase, então não tem RLS envolvida.
 */
export function WallpaperProvider({
  campaignId,
  children,
}: {
  campaignId: string;
  children: React.ReactNode;
}) {
  const [url, setUrlState] = useState("");

  // localStorage não existe no server: só depois da hidratação, senão o HTML
  // do servidor e o do client divergem.
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey(campaignId));
    // Revalida na leitura: o que está no storage pode ter sido editado à mão.
    const check = saved ? parseWallpaperUrl(saved) : null;
    setUrlState(check?.ok ? check.url : "");
  }, [campaignId]);

  const setUrl = useCallback(
    (next: string) => {
      const check = parseWallpaperUrl(next);
      if (!check.ok) {
        setUrlState("");
        window.localStorage.removeItem(storageKey(campaignId));
        return;
      }
      setUrlState(check.url);
      window.localStorage.setItem(storageKey(campaignId), check.url);
    },
    [campaignId],
  );

  const api = useMemo<WallpaperApi>(() => ({ url, setUrl }), [url, setUrl]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
