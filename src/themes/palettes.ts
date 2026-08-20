/**
 * Palettvarianter per tema. Varje variant är en färdig token-uppsättning —
 * ingen färg härleds i runtime.
 *
 * Registret (docs/PALETTE-REGISTRY.md) håller hue-vinklar och kontrastvärden.
 * Regeln "minst 40° mellan accenter" gäller inom ett tema; över hela
 * portföljen är den matematiskt omöjlig vid 6 teman × 4 varianter (24 accenter
 * ryms inte med 40° isär i 360°). Det är en medveten avvikelse, dokumenterad
 * i planens §1.5 — kollisioner syns bara om två grannar i samma bransch får
 * samma tema och variant, och variant väljs manuellt vid publicering.
 */
export type Palette = {
  /** HSL-hue för accenten, i registret. */
  hue: number;
  base: string;
  surface: string;
  surfaceRaised: string;
  ink: string;
  inkMuted: string;
  accent: string;
  /** Textfärg som ligger PÅ accenten. */
  onAccent: string;
  hairline: string;
};

export type ThemePalettes = [Palette, Palette, Palette, Palette];

/** INDUSTRIAL: mörkdominant, hård kant, hög krominans i accenten. */
const servicios: ThemePalettes = [
  {
    hue: 29,
    base: "#12100D",
    surface: "#1B1815",
    surfaceRaised: "#241F1A",
    ink: "#F4EFE8",
    inkMuted: "#A79E92",
    accent: "#FF8A1F",
    onAccent: "#12100D",
    hairline: "rgba(244,239,232,0.12)",
  },
  {
    hue: 186,
    base: "#0B1214",
    surface: "#131E21",
    surfaceRaised: "#19282C",
    ink: "#E9F2F4",
    inkMuted: "#94A6AA",
    accent: "#2ACADC",
    onAccent: "#0B1214",
    hairline: "rgba(233,242,244,0.12)",
  },
  {
    hue: 71,
    base: "#101207",
    surface: "#191C0F",
    surfaceRaised: "#212615",
    ink: "#F0F2E5",
    inkMuted: "#A3A791",
    accent: "#C7E63C",
    onAccent: "#101207",
    hairline: "rgba(240,242,229,0.12)",
  },
  {
    hue: 254,
    base: "#0E0C14",
    surface: "#171422",
    surfaceRaised: "#1F1B2D",
    ink: "#EEEAF6",
    inkMuted: "#9E97AE",
    accent: "#A78BFF",
    onAccent: "#0E0C14",
    hairline: "rgba(238,234,246,0.12)",
  },
];

/**
 * WARM CRAFT: ljus-varm, texturerad, generös luft. Basen är kräm/varmvit och
 * bär grain i låg opacitet; accenten är mättad men mörk nog att bära text.
 */
const gastronomia: ThemePalettes = [
  {
    hue: 11,
    base: "#FBF5EE",
    surface: "#F3E9DC",
    surfaceRaised: "#FFFFFF",
    ink: "#241A14",
    inkMuted: "#6B5A4C",
    accent: "#B23A20",
    onAccent: "#FFF7F2",
    hairline: "rgba(36,26,20,0.14)",
  },
  {
    hue: 52,
    base: "#FAF7EC",
    surface: "#F0EBD7",
    surfaceRaised: "#FFFDF6",
    ink: "#1F2016",
    inkMuted: "#5F6152",
    accent: "#7A6B10",
    onAccent: "#FFFDF0",
    hairline: "rgba(31,32,22,0.14)",
  },
  {
    hue: 149,
    base: "#F4F8F3",
    surface: "#E6EFE5",
    surfaceRaised: "#FFFFFF",
    ink: "#16201A",
    inkMuted: "#4F6357",
    accent: "#1C7A4A",
    onAccent: "#F2FBF5",
    hairline: "rgba(22,32,26,0.14)",
  },
  {
    hue: 313,
    base: "#FCF4F8",
    surface: "#F6E6EF",
    surfaceRaised: "#FFFFFF",
    ink: "#231627",
    inkMuted: "#685467",
    accent: "#96177A",
    onAccent: "#FFF2FB",
    hairline: "rgba(35,22,39,0.14)",
  },
];

/**
 * EDITORIAL: ljusdominant, platta ytor och hårstrecksramar, en accent.
 * Nästan neutral bas — kundens produktbilder ska bära färgen, inte temat.
 */
const comercio: ThemePalettes = [
  {
    hue: 212,
    base: "#F7F8FA",
    surface: "#EDF0F5",
    surfaceRaised: "#FFFFFF",
    ink: "#14181D",
    inkMuted: "#56616F",
    accent: "#0E4E96",
    onAccent: "#F4F8FF",
    hairline: "rgba(20,24,29,0.13)",
  },
  {
    hue: 163,
    base: "#F5F9F7",
    surface: "#E8F1EC",
    surfaceRaised: "#FFFFFF",
    ink: "#101A16",
    inkMuted: "#4C6058",
    accent: "#0A6E52",
    onAccent: "#F2FBF7",
    hairline: "rgba(16,26,22,0.13)",
  },
  {
    hue: 271,
    base: "#F8F6FB",
    surface: "#EEEAF6",
    surfaceRaised: "#FFFFFF",
    ink: "#191424",
    inkMuted: "#5C5470",
    accent: "#7A2FBF",
    onAccent: "#F9F5FF",
    hairline: "rgba(25,20,36,0.13)",
  },
  {
    hue: 35,
    base: "#FAF7F2",
    surface: "#F1EBE1",
    surfaceRaised: "#FFFFFF",
    ink: "#1D1A14",
    inkMuted: "#63594B",
    accent: "#8C5304",
    onAccent: "#FFFBF2",
    hairline: "rgba(29,26,20,0.13)",
  },
];

/**
 * Teman utan egen palett faller tillbaka på servicios tills de byggs
 * (PR-15: salud + belleza + taller).
 */
export const PALETTES: Record<string, ThemePalettes> = {
  servicios,
  gastronomia,
  comercio,
};

export function paletteFor(themeKey: string, variant: number): Palette {
  const set = PALETTES[themeKey] ?? PALETTES.servicios;
  const index = Math.min(Math.max(variant, 1), 4) - 1;
  return set[index];
}

/** Palett → CSS-variabler. Sätts på temats rot-element, aldrig på :root. */
export function paletteToCssVars(p: Palette): Record<string, string> {
  return {
    "--base": p.base,
    "--surface": p.surface,
    "--surface-raised": p.surfaceRaised,
    "--ink": p.ink,
    "--ink-muted": p.inkMuted,
    "--accent": p.accent,
    "--on-accent": p.onAccent,
    "--hairline": p.hairline,
  };
}
