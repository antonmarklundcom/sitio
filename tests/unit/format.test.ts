import { describe, expect, it } from "vitest";
import { displayPhone, formatGs, normalizePyPhone, parseGs, waLink } from "@/lib/format";

describe("formatGs", () => {
  it("skriver guaraníes utan decimaler", () => {
    expect(formatGs(300_000)).toMatch(/^₲ 300[.\s  ]000$/);
  });

  it("säger 'A consultar' när priset saknas", () => {
    expect(formatGs(null)).toBe("A consultar");
    expect(formatGs(undefined)).toBe("A consultar");
  });

  it("skriver noll som en siffra, inte som saknat pris", () => {
    expect(formatGs(0)).toBe("₲ 0");
  });
});

describe("normalizePyPhone", () => {
  it("accepterar nationellt format med nolla och mellanslag", () => {
    expect(normalizePyPhone("0981 123 456")).toBe("+595981123456");
  });

  it("accepterar nummer utan inledande nolla", () => {
    expect(normalizePyPhone("981123456")).toBe("+595981123456");
  });

  it("accepterar redan normaliserade nummer", () => {
    expect(normalizePyPhone("+595981123456")).toBe("+595981123456");
    expect(normalizePyPhone("595981123456")).toBe("+595981123456");
  });

  it("accepterar fastnummer med åtta siffror", () => {
    expect(normalizePyPhone("021 123 456")).toBe("+59521123456");
  });

  it("strippar skiljetecken", () => {
    expect(normalizePyPhone("(0981) 123-456")).toBe("+595981123456");
  });

  it("returnerar null för för korta nummer", () => {
    expect(normalizePyPhone("1234567")).toBeNull();
  });

  it("returnerar null för för långa nummer", () => {
    expect(normalizePyPhone("09811234567890")).toBeNull();
  });

  it("returnerar null för tomt och för ren text", () => {
    expect(normalizePyPhone("")).toBeNull();
    expect(normalizePyPhone("no es un número")).toBeNull();
  });
});

describe("displayPhone", () => {
  it("grupperar mobilnummer 3-3-3", () => {
    expect(displayPhone("+595981123456")).toBe("+595 981 123 456");
  });

  it("grupperar fastnummer 2-3-3", () => {
    expect(displayPhone("+59521123456")).toBe("+595 21 123 456");
  });

  it("lämnar okända format orörda", () => {
    expect(displayPhone("+46701234567")).toBe("+46701234567");
  });
});

describe("waLink", () => {
  it("bygger en wa.me-länk utan plustecken", () => {
    expect(waLink("+595981123456")).toBe("https://wa.me/595981123456");
  });

  it("urlkodar meddelandet", () => {
    expect(waLink("+595981123456", "Hola, ¿está abierto?")).toBe(
      "https://wa.me/595981123456?text=Hola%2C%20%C2%BFest%C3%A1%20abierto%3F",
    );
  });

  it("utelämnar text-parametern när meddelandet är tomt", () => {
    expect(waLink("+595981123456", "")).toBe("https://wa.me/595981123456");
  });
});

describe("parseGs (R3-32)", () => {
  it.each([
    ["300000", 300000],
    ["300.000", 300000],
    ["1.500.000", 1500000],
    ["₲ 300.000", 300000],
    ["Gs. 300.000", 300000],
    ["300 000", 300000],
    ["15.000,00", 15000],
    [" 45000 ", 45000],
  ])("%s ⇒ %d", (raw, expected) => {
    expect(parseGs(raw)).toBe(expected);
  });

  it("tomt är null", () => {
    expect(parseGs("")).toBeNull();
    expect(parseGs("   ")).toBeNull();
    expect(parseGs(null)).toBeNull();
  });

  it.each(["35 mil", "1.5", "1,5", "15.000,50", "30.00", "abc", "-5"])("%s är ogiltigt", (raw) => {
    expect(Number.isNaN(parseGs(raw))).toBe(true);
  });
});
