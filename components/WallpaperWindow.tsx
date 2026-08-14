"use client";

import { useEffect, useState } from "react";
import { useWallpaper } from "@/lib/campaign/WallpaperProvider";
import { parseWallpaperUrl, wallpaperStyle } from "@/lib/wallpaper";

/** Atalhos de textura que combinam com a estética da mesa. */
const PRESETS = [
  { label: "Cortiça", url: "https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?w=1600" },
  { label: "Concreto", url: "https://images.unsplash.com/photo-1523554888454-84137e204c8c?w=1600" },
  { label: "Mapa antigo", url: "https://images.unsplash.com/photo-1519500099198-fd81846b8f03?w=1600" },
];

export function WallpaperWindow() {
  const { url, setUrl } = useWallpaper();
  const [draft, setDraft] = useState(url);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  // A janela pode ficar aberta enquanto o papel muda por um preset.
  useEffect(() => {
    setDraft(url);
  }, [url]);

  const preview = parseWallpaperUrl(draft);

  function apply(value: string) {
    const check = parseWallpaperUrl(value);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setError(null);
    setBroken(false);
    setUrl(check.url);
  }

  function reset() {
    setError(null);
    setBroken(false);
    setDraft("");
    setUrl("");
  }

  return (
    <>
      <p style={{ fontSize: "0.8125rem", color: "var(--ink-soft)", marginTop: 0 }}>
        Cole o link direto de uma imagem (imgur, catbox, Unsplash…). Nada é enviado pro servidor:
        o link fica guardado só neste navegador, por mesa.
      </p>

      <div className="wallpaper-row">
        <input
          type="url"
          inputMode="url"
          placeholder="https://i.imgur.com/exemplo.jpg"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
            setBroken(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply(draft);
          }}
        />
        <button onClick={() => apply(draft)}>Aplicar</button>
        <button className="wallpaper-reset" onClick={reset}>
          Padrão
        </button>
      </div>

      {error && <div className="login-error">{error}</div>}
      {broken && (
        <div className="login-error">
          O link carregou vazio. Confirme que ele aponta pro arquivo da imagem (termina em .jpg,
          .png, .webp) e não pra página do site.
        </div>
      )}

      <div className="wallpaper-presets">
        {PRESETS.map((p) => (
          <button key={p.url} onClick={() => apply(p.url)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="wallpaper-preview" style={preview.ok ? wallpaperStyle(preview.url) : undefined}>
        {!preview.ok && <span>Sem papel de parede — fundo padrão do dossiê.</span>}
      </div>

      {/* Fora do fluxo, só pra saber se a URL carrega de verdade. */}
      {preview.ok && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={preview.url}
          style={{ display: "none" }}
          onError={() => setBroken(true)}
          onLoad={() => setBroken(false)}
        />
      )}
    </>
  );
}
