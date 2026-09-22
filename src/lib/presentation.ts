import { CATEGORIES, THEME_KEYS } from "./business";

/**
 * Bransch → tema och palettvariant (plan.md §1.11, docs/PLAN.md §1.5).
 *
 * Branschen bestämmer utseendet. Det finns ingen väljare i admin, ingen
 * override per kund: `themeKey` och `paletteVariant` härleds här och skrivs av
 * varje väg som skapar eller sparar ett företag. Kolumnerna finns kvar i
 * schemat som det lagrade, alltid synkade resultatet.
 *
 * Sju utseenden i produktion i stället för tjugofyra. Två grannar i samma
 * bransch ser likadana ut med avsikt — identiteten kommer från logga, foton
 * och putsad text, inte från dekorationen. Varje tema har exakt två
 * varianter (src/themes/palettes.ts); båda väljs av tabellen nedan.
 *
 * Ren modul: inga importer från `db`, React eller Next. Enhetstestet låser
 * tabellen mot en literal, så en drift blir ett rött test och inte en
 * överraskning på en publicerad sajt.
 */

export type Category = (typeof CATEGORIES)[number];
export type ThemeKey = (typeof THEME_KEYS)[number];

export type Presentation = {
  themeKey: ThemeKey;
  /** 1–2, index i temats palettpar (plan.md §1.11). */
  paletteVariant: number;
  /** Accentens namn på svenska, för admin-etiketten. */
  accent: string;
};

export const PRESENTATION_BY_CATEGORY: Record<Category, Presentation> = {
  servicios: { themeKey: "servicios", paletteVariant: 2, accent: "azul" },
  taller: { themeKey: "servicios", paletteVariant: 1, accent: "ámbar" },
  comercio: { themeKey: "comercio", paletteVariant: 1, accent: "carmín" },
  otro: { themeKey: "comercio", paletteVariant: 2, accent: "verde" },
  gastronomia: { themeKey: "gastronomia", paletteVariant: 1, accent: "terracota" },
  salud: { themeKey: "salud", paletteVariant: 1, accent: "petróleo" },
  belleza: { themeKey: "salud", paletteVariant: 2, accent: "orquídea" },
};

/** Okänd bransch behandlas som `otro` — det neutralaste temat är det säkraste. */
function entryFor(category: string): Presentation {
  return PRESENTATION_BY_CATEGORY[category as Category] ?? PRESENTATION_BY_CATEGORY.otro;
}

/** Det som skrivs till databasen. Anropas av varje skrivväg, aldrig av formuläret. */
export function presentationFor(category: string): { themeKey: ThemeKey; paletteVariant: number } {
  const { themeKey, paletteVariant } = entryFor(category);
  return { themeKey, paletteVariant };
}

/** Admin-etikett: `servicios · variante 2 (azul)`. */
export function presentationLabel(category: string): string {
  const { themeKey, paletteVariant, accent } = entryFor(category);
  return `${themeKey} · variante ${paletteVariant} (${accent})`;
}
