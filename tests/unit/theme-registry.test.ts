import { describe, expect, it, vi } from "vitest";
import { PALETTES, paletteFor } from "@/themes/palettes";

/**
 * `registry.ts` importerar temakomponenterna (.tsx). tsconfig.json sätter
 * `jsx: "preserve"` för Next/SWC, och vitest saknar en JSX-transform för det
 * — att importera en riktig temakomponent här kraschar vite:import-analysis.
 * Komponenterna stubbas därför bort; testet gäller registrets DATA
 * (vilka nycklar som är byggda), inte renderingen — den täcks av QA-gaten
 * (`npm run theme:preview && npm run theme:shots`).
 */
vi.mock("@/themes/servicios/servicios-theme", () => ({ ServiciosTheme: () => null }));
vi.mock("@/themes/gastronomia/gastronomia-theme", () => ({ GastronomiaTheme: () => null }));
vi.mock("@/themes/comercio/comercio-theme", () => ({ ComercioTheme: () => null }));
vi.mock("@/themes/salud/salud-theme", () => ({ SaludTheme: () => null }));

const { BUILT_THEMES, isThemeBuilt, themeComponent } = await import("@/themes/registry");
const { SaludTheme } = await import("@/themes/salud/salud-theme");
const { ServiciosTheme } = await import("@/themes/servicios/servicios-theme");

describe("temaregistret", () => {
  it("salud är byggt", () => {
    expect(BUILT_THEMES).toContain("salud");
    expect(isThemeBuilt("salud")).toBe(true);
  });

  it("themeComponent slår upp salud, inte fallbacken", () => {
    expect(themeComponent("salud")).toBe(SaludTheme);
    expect(themeComponent("salud")).not.toBe(ServiciosTheme);
  });

  it("belleza och taller är fortfarande inte egna teman (plan §1.12)", () => {
    expect(isThemeBuilt("belleza")).toBe(false);
    expect(isThemeBuilt("taller")).toBe(false);
    expect(BUILT_THEMES).not.toContain("belleza");
    expect(BUILT_THEMES).not.toContain("taller");
  });

  it("okänt tema faller tillbaka på servicios", () => {
    expect(themeComponent("nonexistent")).toBe(ServiciosTheme);
    expect(isThemeBuilt("nonexistent")).toBe(false);
  });
});

describe.each(["servicios", "gastronomia", "comercio", "salud"])("%s palett", (themeKey) => {
  it("har två kompletta varianter", () => {
    expect(PALETTES[themeKey]).toHaveLength(2);
    for (const p of PALETTES[themeKey]) {
      for (const token of ["base", "surface", "surfaceRaised", "ink", "inkMuted", "accent", "onAccent"] as const) {
        expect(p[token]).toMatch(/^#[0-9A-F]{6}$/i);
      }
      expect(p.hairline).toMatch(/^rgba\(.+\)$/);
      expect(Number.isFinite(p.hue)).toBe(true);
    }
  });

  it("varianternas hue ligger minst 40° isär", () => {
    const hues = PALETTES[themeKey].map((p) => p.hue);
    const diff = Math.abs(hues[0] - hues[1]);
    expect(Math.min(diff, 360 - diff)).toBeGreaterThanOrEqual(40);
  });

  it("paletteFor hämtar rätt variant och begränsar till 1–2", () => {
    expect(paletteFor(themeKey, 1)).toBe(PALETTES[themeKey][0]);
    expect(paletteFor(themeKey, 2)).toBe(PALETTES[themeKey][1]);
    for (const variant of [3, 4, 99]) {
      expect(paletteFor(themeKey, variant)).toBe(PALETTES[themeKey][1]);
    }
    for (const variant of [0, -1]) {
      expect(paletteFor(themeKey, variant)).toBe(PALETTES[themeKey][0]);
    }
  });
});

it("paletteFor använder servicios för ett okänt tema", () => {
  expect(paletteFor("nonexistent", 1)).toBe(PALETTES.servicios[0]);
  expect(paletteFor("nonexistent", 4)).toBe(PALETTES.servicios[1]);
});
