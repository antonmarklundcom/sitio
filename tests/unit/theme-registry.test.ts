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

describe("saluds palett", () => {
  it("har fyra kompletta varianter", () => {
    expect(PALETTES.salud).toHaveLength(4);
    for (const p of PALETTES.salud) {
      expect(p.base).toMatch(/^#/);
      expect(p.accent).toMatch(/^#/);
      expect(typeof p.hue).toBe("number");
    }
  });

  it("varianternas hue ligger minst 40° isär", () => {
    const hues = PALETTES.salud.map((p) => p.hue);
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const diff = Math.abs(hues[i] - hues[j]);
        const circular = Math.min(diff, 360 - diff);
        expect(circular).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it("paletteFor('salud', n) hämtar rätt variant", () => {
    expect(paletteFor("salud", 1).hue).toBe(PALETTES.salud[0].hue);
    expect(paletteFor("salud", 2).hue).toBe(PALETTES.salud[1].hue);
    expect(paletteFor("salud", 4).hue).toBe(PALETTES.salud[3].hue);
  });
});
