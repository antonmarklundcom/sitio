import { describe, expect, it } from "vitest";
import { LAZY_ROLLUP_INTERVAL_MS, dayRange, lazyRollupDue } from "@/lib/rollup";
import { dayKeyAsuncion, windowStartAsuncion } from "@/lib/analytics";

/**
 * `db` importeras av rollup.ts men skapar poolen lat, så modulen går att
 * importera utan databas. Allt som faktiskt frågar är smoke-territorium.
 */
describe("dayRange", () => {
  it("ger exakt så många dygn som begärts", () => {
    expect(dayRange(1)).toHaveLength(1);
    expect(dayRange(3)).toHaveLength(3);
    expect(dayRange(60)).toHaveLength(60);
  });

  it("slutar på dagens datum i Asunción", () => {
    const range = dayRange(3);
    expect(range[range.length - 1]).toBe(dayKeyAsuncion());
  });

  it("är sorterat stigande, nyast sist", () => {
    const range = dayRange(10);
    expect([...range].sort()).toEqual(range);
  });

  it("ger sammanhängande dygn utan hål", () => {
    const range = dayRange(5);
    for (let i = 1; i < range.length; i += 1) {
      const prev = new Date(`${range[i - 1]}T00:00:00Z`).getTime();
      const cur = new Date(`${range[i]}T00:00:00Z`).getTime();
      expect(cur - prev).toBe(86_400_000);
    }
  });

  it("formaterar varje dygn som YYYY-MM-DD", () => {
    for (const day of dayRange(4)) expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("lazyRollupDue (R3-41)", () => {
  const t0 = Date.UTC(2026, 8, 23, 12, 0, 0);
  it("kör första gången och igen efter tio minuter, inte däremellan", () => {
    expect(lazyRollupDue(null, t0)).toBe(true);
    expect(lazyRollupDue(t0, t0 + 60_000)).toBe(false);
    expect(lazyRollupDue(t0, t0 + LAZY_ROLLUP_INTERVAL_MS - 1)).toBe(false);
    expect(lazyRollupDue(t0, t0 + LAZY_ROLLUP_INTERVAL_MS)).toBe(true);
  });
  it("samma dygn räcker inte längre: 'hoy' uppdateras under dagen", () => {
    expect(lazyRollupDue(t0, t0 + 3 * 60 * 60 * 1000)).toBe(true);
  });
  it("en klocka som gått bakåt kör i stället för att vänta", () => {
    expect(lazyRollupDue(t0, t0 - 1000)).toBe(true);
  });
});

describe("windowStartAsuncion (R3-41)", () => {
  it("30 dygn = idag + 29 dygn före, på Asunción-dygnet", () => {
    // 02:00 UTC den 14:e är fortfarande den 13:e i Asunción.
    expect(windowStartAsuncion(30, new Date("2026-09-14T02:00:00Z"))).toBe("2026-08-15");
    expect(windowStartAsuncion(30, new Date("2026-09-14T12:00:00Z"))).toBe("2026-08-16");
    expect(windowStartAsuncion(1, new Date("2026-09-14T12:00:00Z"))).toBe("2026-09-14");
  });
});
