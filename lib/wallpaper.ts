/**
 * Papel de parede é só um link (imgur, catbox, qualquer host direto). Nada de
 * upload nem de imagem no banco — o que guardamos é a string da URL.
 */

export type WallpaperCheck = { ok: true; url: string } | { ok: false; reason: string };

/** Aceita só http(s): sem isso um `javascript:`/`data:` entraria no CSS. */
export function parseWallpaperUrl(raw: string): WallpaperCheck {
  const value = raw.trim();
  if (!value) return { ok: false, reason: "Cole o link de uma imagem." };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: "Isso não parece um link completo (falta o https://?)." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "Use um link http(s) direto pra imagem." };
  }
  return { ok: true, url: parsed.toString() };
}

/**
 * `url("…")` é uma string CSS: aspas e barras invertidas escapam pra que a URL
 * não consiga fechar a string e emendar outra declaração.
 */
export function wallpaperStyle(url: string): React.CSSProperties {
  return { backgroundImage: `url("${url.replace(/["\\]/g, encodeURIComponent)}")` };
}
