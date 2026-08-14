/**
 * Escala da interface, definida em `--ui-scale` no globals.css.
 *
 * O CSS todo está em rem, então o layout acompanha a escala sozinho. O que não
 * acompanha são as contas em px do JS — `clientX`, `innerWidth` e coordenadas
 * guardadas no banco continuam em px reais. Quem mistura os dois (arrastar
 * janela, mural de evidências) converte com isto.
 */

/** Estático depois do primeiro paint; ler do CSS a cada pointermove seria caro. */
let cached: number | null = null;

export function uiScale(): number {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return 1;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--ui-scale");
  const parsed = Number.parseFloat(raw);
  cached = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  return cached;
}

/** Converte uma medida pensada na base de 16px pra px reais da tela. */
export function scaled(designPx: number): number {
  return designPx * uiScale();
}
