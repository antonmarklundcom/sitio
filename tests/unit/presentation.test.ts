import { describe, expect, it, vi } from "vitest";
import { CATEGORIES, THEME_KEYS } from "@/lib/business";
import {
  PRESENTATION_BY_CATEGORY,
  presentationFor,
  presentationLabel,
} from "@/lib/presentation";

// Temakomponenterna stubbas bort av samma skäl som i theme-registry.test.ts:
// vitest saknar JSX-transform för tsconfigs `jsx: "preserve"`. Här används
// bara registrets data (vilka nycklar som är byggda).
vi.mock("@/themes/servicios/servicios-theme", () => ({ ServiciosTheme: () => null }));
vi.mock("@/themes/gastronomia/gastronomia-theme", () => ({ GastronomiaTheme: () => null }));
vi.mock("@/themes/comercio/comercio-theme", () => ({ ComercioTheme: () => null }));
vi.mock("@/themes/salud/salud-theme", () => ({ SaludTheme: () => null }));

const { BUILT_THEMES } = await import("@/themes/registry");

/**
 * Tabellen i plan.md §1.11 / docs/PLAN.md §1.5 är produktbeslutet; det här
 * testet är dess lås. Jämförelsen sker mot en literal och inte i en loop —
 * en loop över samma källa hade följt med i en drift utan att säga något.
 */
describe("PRESENTATION_BY_CATEGORY", () => {
  it("är exakt tabellen i plan §1.11", () => {
    expect(PRESENTATION_BY_CATEGORY).toEqual({
      servicios: { themeKey: "servicios", paletteVariant: 2, accent: "cyan" },
      taller: { themeKey: "servicios", paletteVariant: 1, accent: "orange" },
      comercio: { themeKey: "comercio", paletteVariant: 1, accent: "blå" },
      otro: { themeKey: "comercio", paletteVariant: 2, accent: "grön" },
      gastronomia: { themeKey: "gastronomia", paletteVariant: 1, accent: "rödbrun" },
      salud: { themeKey: "salud", paletteVariant: 1, accent: "teal" },
      belleza: { themeKey: "salud", paletteVariant: 2, accent: "rosa" },
    });
  });

  it("täcker varje bransch, utan extra nycklar", () => {
    expect(Object.keys(PRESENTATION_BY_CATEGORY).sort()).toEqual([...CATEGORIES].sort());
  });
});

describe("presentationFor", () => {
  it("ger ett themeKey ur THEME_KEYS för varje bransch", () => {
    for (const category of CATEGORIES) {
      expect(THEME_KEYS).toContain(presentationFor(category).themeKey);
    }
  });

  it("ger en variant mellan 1 och 4 för varje bransch", () => {
    for (const category of CATEGORIES) {
      const { paletteVariant } = presentationFor(category);
      expect(Number.isInteger(paletteVariant)).toBe(true);
      expect(paletteVariant).toBeGreaterThanOrEqual(1);
      expect(paletteVariant).toBeLessThanOrEqual(4);
    }
  });

  it("pekar bara på byggda teman — aldrig på belleza eller taller (§1.12)", () => {
    for (const category of CATEGORIES) {
      const { themeKey } = presentationFor(category);
      expect(BUILT_THEMES).toContain(themeKey);
      expect(themeKey).not.toBe("belleza");
      expect(themeKey).not.toBe("taller");
    }
  });

  it("returnerar bara kolumnerna som skrivs, inte accentnamnet", () => {
    expect(presentationFor("taller")).toEqual({ themeKey: "servicios", paletteVariant: 1 });
  });

  it("faller tillbaka på otro för en okänd bransch", () => {
    expect(presentationFor("kryptovaluta")).toEqual(presentationFor("otro"));
  });
});

describe("presentationLabel", () => {
  it("skriver tema, variant och accent på svenska", () => {
    expect(presentationLabel("servicios")).toBe("servicios · variant 2 (cyan)");
    expect(presentationLabel("belleza")).toBe("salud · variant 2 (rosa)");
  });

  it("ger en etikett för varje bransch", () => {
    for (const category of CATEGORIES) {
      expect(presentationLabel(category)).toMatch(/^[a-z]+ · variant [1-4] \(.+\)$/);
    }
  });
});
