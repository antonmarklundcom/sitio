/**
 * Palettvarianter per tema. Varje variant är en färdig token-uppsättning —
 * ingen färg härleds i runtime.
 *
 * Registret (docs/PALETTE-REGISTRY.md) håller hue-vinklar och kontrastvärden.
 * Regeln "minst 40° mellan accenter" gäller inom ett tema. Varje tema har
 * två varianter; tema och variant härleds från verksamhetens kategori via
 * presentationFor (src/lib/presentation.ts).
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

export type ThemePalettes = [Palette, Palette];

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
];

/**
 * CALM: ljusdominant, sval-neutral bas med en svag blågrön ton, en djup
 * accent som bara lever på CTA/status/länkar. v1 (teal) är låst till `salud`,
 * v2 (rose) till `belleza` (plan §1.11).
 */
const salud: ThemePalettes = [
  {
    hue: 174,
    base: "#F3F8F7",
    surface: "#E6F0EE",
    surfaceRaised: "#FFFFFF",
    ink: "#0E211D",
    inkMuted: "#4E6864",
    accent: "#0B6B62",
    onAccent: "#F1FBF9",
    hairline: "rgba(14,33,29,0.13)",
  },
  {
    hue: 329,
    base: "#F8F4F6",
    surface: "#F1E5EA",
    surfaceRaised: "#FFFFFF",
    ink: "#251620",
    inkMuted: "#6B5560",
    accent: "#93275F",
    onAccent: "#FFF1F7",
    hairline: "rgba(37,22,32,0.13)",
  },
];

/**
 * Teman utan egen palett faller tillbaka på servicios tills de byggs
 * (belleza + taller renderar på befintliga teman med låst variant, §1.12 —
 * de får aldrig en egen post här).
 */
export const PALETTES: Record<string, ThemePalettes> = {
  servicios,
  gastronomia,
  comercio,
  salud,
};

export function paletteFor(themeKey: string, variant: number): Palette {
  const set = PALETTES[themeKey] ?? PALETTES.servicios;
  const index = Math.min(Math.max(variant, 1), 2) - 1;
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
