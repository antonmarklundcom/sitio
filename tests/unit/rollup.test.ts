import { describe, expect, it } from "vitest";
import { dayRange } from "@/lib/rollup";
import { dayKeyAsuncion } from "@/lib/analytics";

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
