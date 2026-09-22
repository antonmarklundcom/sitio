/**
 * Palettvarianter per tema. Varje variant är en färdig token-uppsättning —
 * ingen färg härleds i runtime.
 *
 * Registret (docs/PALETTE-REGISTRY.md) håller hue-vinklar och uppmätta
 * kontrastvärden. Regeln "minst 40° mellan accenter" gäller inom ett tema.
 * Varje tema har två varianter; tema och variant härleds från verksamhetens
 * kategori via presentationFor (src/lib/presentation.ts).
 *
 * ── Varför accenten är tre tokens och inte en (ändring mot v1) ───────────
 * Alla fyra teman är numera ljusdominanta. En enda accent-token tvingade
 * fram ett omöjligt val: färgen skulle både bära vit/svart text som fyllning
 * OCH klara 4,5:1 som liten text mot en ljus bas. En signalorange klarar det
 * första men aldrig det andra, så v1 fick en brun-dämpad "orange" som inte
 * läste som orange. Nu:
 *
 *   accent       fyllningar (knappar, chips, linjer). Bär `onAccent` som text.
 *   accentInk    accentfärgad TEXT på ljus botten (länkar, eyebrow, siffror).
 *   accentLight  accent på det mörka avslutsbandet (`deep`).
 *
 * `deep` är temats mörka ton — hero utan foto och avslutsbandet. Den är
 * tonad per tema i stället för svart, så att det mörka bandet hör hemma i
 * paletten i stället för att läsa som ett hål i sidan.
 */
export type Palette = {
  /** HSL-hue för `accent`, i registret. */
  hue: number;
  base: string;
  surface: string;
  surfaceRaised: string;
  /** Temats mörka ton: monogram-hero och avslutsbandet. */
  deep: string;
  ink: string;
  inkMuted: string;
  /** Fyllningsfärg. Bär `onAccent` som text. */
  accent: string;
  /** Accent som TEXT på ljus botten (≥4,5:1 mot base/surface/surfaceRaised). */
  accentInk: string;
  /** Accent på `deep` (≥4,5:1 mot deep). */
  accentLight: string;
  /** Textfärg som ligger PÅ accent. */
  onAccent: string;
  hairline: string;
};

export type ThemePalettes = [Palette, Palette];

/**
 * TALLER — ljus stålgrå bas, hårda kanter, signalfärg. Verkstäder och
 * tekniska tjänster: bilden är oftast en maskin eller ett arbete i halvdager,
 * och en sval neutral låter den vara den enda färgen i rummet.
 */
const servicios: ThemePalettes = [
  {
    hue: 35,
    base: "#F1F2F3",
    surface: "#E4E6E8",
    surfaceRaised: "#FFFFFF",
    deep: "#161A1E",
    ink: "#15181B",
    inkMuted: "#4E575F",
    accent: "#BE7103",
    accentInk: "#8A5303",
    accentLight: "#EFB55C",
    onAccent: "#1B1304",
    hairline: "rgba(21,24,27,0.14)",
  },
  {
    hue: 221,
    base: "#F1F2F3",
    surface: "#E4E6E8",
    surfaceRaised: "#FFFFFF",
    deep: "#161A1E",
    ink: "#15181B",
    inkMuted: "#4E575F",
    accent: "#1D4FB8",
    accentInk: "#1D4FB8",
    accentLight: "#96B6F2",
    onAccent: "#F2F6FF",
    hairline: "rgba(21,24,27,0.14)",
  },
];

/**
 * COCINA — krämvit, varm, texturerad. Maten är röd, brun och gul; basen är
 * det enda som kan vara lugnt, annars slåss sidan med tallriken.
 */
const gastronomia: ThemePalettes = [
  {
    hue: 12,
    base: "#FBF6EC",
    surface: "#F3E9D8",
    surfaceRaised: "#FFFFFF",
    deep: "#2A1B11",
    ink: "#231A12",
    inkMuted: "#6B5844",
    accent: "#B5391B",
    accentInk: "#93331A",
    accentLight: "#EDA083",
    onAccent: "#FFF4EE",
    hairline: "rgba(35,26,18,0.15)",
  },
  {
    hue: 67,
    base: "#FBF6EC",
    surface: "#F3E9D8",
    surfaceRaised: "#FFFFFF",
    deep: "#22220F",
    ink: "#231A12",
    inkMuted: "#6B5844",
    accent: "#6B7714",
    accentInk: "#55600F",
    accentLight: "#C3CE72",
    onAccent: "#FAFCEE",
    hairline: "rgba(35,26,18,0.15)",
  },
];

/**
 * MERCADO — pappersvitt, nästan neutralt, en stark accent. Kundens
 * produktbilder ska bära färgen; temat håller sig ur vägen och ger i stället
 * ordning: raka linjer, tydliga priser, snabb skanning.
 */
const comercio: ThemePalettes = [
  {
    hue: 344,
    base: "#F6F7F8",
    surface: "#EAECEF",
    surfaceRaised: "#FFFFFF",
    deep: "#14171B",
    ink: "#15181C",
    inkMuted: "#525C66",
    accent: "#C21744",
    accentInk: "#A8123C",
    accentLight: "#F291AC",
    onAccent: "#FFF2F5",
    hairline: "rgba(21,24,28,0.13)",
  },
  {
    hue: 143,
    base: "#F6F7F8",
    surface: "#EAECEF",
    surfaceRaised: "#FFFFFF",
    deep: "#14171B",
    ink: "#15181C",
    inkMuted: "#525C66",
    accent: "#1C6B3A",
    accentInk: "#186032",
    accentLight: "#79CD9B",
    onAccent: "#F1FAF4",
    hairline: "rgba(21,24,28,0.13)",
  },
];

/**
 * CALMA — blekt blågrön bas, mjuka former, mycket luft. Vård och skönhet
 * säljer lugn; v1 (petroleum) är låst till `salud`, v2 (orkidé) till
 * `belleza` (plan §1.11).
 */
const salud: ThemePalettes = [
  {
    hue: 187,
    base: "#F2F7F7",
    surface: "#E3EFEF",
    surfaceRaised: "#FFFFFF",
    deep: "#0A2725",
    ink: "#10211F",
    inkMuted: "#4C6462",
    accent: "#0B6470",
    accentInk: "#0B6470",
    accentLight: "#7CCCD7",
    onAccent: "#F0FBFC",
    hairline: "rgba(16,33,31,0.13)",
  },
  {
    hue: 311,
    base: "#F8F4F7",
    surface: "#F0E6ED",
    surfaceRaised: "#FFFFFF",
    deep: "#241220",
    ink: "#221520",
    inkMuted: "#665264",
    accent: "#9A2C86",
    accentInk: "#872676",
    accentLight: "#E19BD6",
    onAccent: "#FFF1FB",
    hairline: "rgba(34,21,32,0.13)",
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
    "--deep": p.deep,
    "--ink": p.ink,
    "--ink-muted": p.inkMuted,
    "--accent": p.accent,
    "--accent-ink": p.accentInk,
    "--accent-light": p.accentLight,
    "--on-accent": p.onAccent,
    "--hairline": p.hairline,
  };
}
