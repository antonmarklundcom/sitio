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
 * Teman utan egen palett faller tillbaka på servicios tills de byggs
 * (PR-07: gastronomia + comercio, PR-15: salud + belleza + taller).
 */
export const PALETTES: Record<string, ThemePalettes> = {
  servicios,
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
