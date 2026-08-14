// Regras do sistema Efeitos Colaterais. Portado 1:1 do protótipo — o MVP fixa
// atributos/perícias/karma neste sistema (seção 8 do briefing).

export const ARCHETYPES = ["Hard", "Intel", "Soft"] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const COLORS: Record<Archetype, string> = {
  Hard: "#8f2d2d",
  Intel: "#b8860b",
  Soft: "#2e6b64",
};

export const ATTR_LIST = [
  "Físico",
  "Reflexo",
  "Intelecto",
  "Percepção",
  "Empatia",
  "Influência",
] as const;
export type AttrName = (typeof ATTR_LIST)[number];

export const SKILL_CATS: Record<Archetype, readonly string[]> = {
  Hard: ["Pontaria", "Combate Corpo-a-Corpo", "Condução/Perseguição", "Resistência"],
  Intel: ["Perícia Forense", "Investigação", "Tecnologia", "Rastreamento"],
  Soft: ["Persuasão", "Manipulação", "Rede de Contatos", "Primeiros Socorros"],
};

export const ALL_SKILLS = ARCHETYPES.flatMap((a) => SKILL_CATS[a]);

export const WOUND_STEPS = [
  "Ileso",
  "Ferido Leve",
  "Ferido Grave",
  "Incapacitado",
  "Morto",
] as const;

export const ACTS = [
  { value: 1, label: "1 — 2019: Investigação" },
  { value: 2, label: "2 — Virada: a farmacêutica" },
  { value: 3, label: "3 — 2020: Clímax na pandemia" },
  { value: 4, label: "4 — Epílogo: a cura (incerta)" },
] as const;

export type Attrs = Record<string, number>;
export type Skills = Record<string, number>;

export const attrMod = (value: number) => value - 3;

export const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

export function karmaTierName(v: number): string {
  if (v <= -2) return "Corrupto";
  if (v === -1) return "Questionável";
  if (v === 0) return "Neutro";
  if (v === 1) return "Íntegro";
  return "Exemplar";
}

export function karmaTierClass(v: number): string {
  if (v <= -2) return "tier-corrupto";
  if (v === -1) return "tier-questionavel";
  if (v === 0) return "tier-neutro";
  if (v === 1) return "tier-integro";
  return "tier-exemplar";
}

export function defaultAttrs(): Attrs {
  return Object.fromEntries(ATTR_LIST.map((a) => [a, 3]));
}

export function defaultSkills(): Skills {
  return Object.fromEntries(ALL_SKILLS.map((s) => [s, 0]));
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Perícia: 0 destreinado, 2 treinado, 4 especialista. Dois "dots" na ficha. */
export function nextSkillLevel(current: number, dotIndex: 1 | 2): number {
  if (dotIndex === 1) return current >= 2 ? 0 : 2;
  return current >= 4 ? 2 : 4;
}

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}
