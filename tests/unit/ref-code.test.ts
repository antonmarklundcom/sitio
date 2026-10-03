import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eventRefCode } from "@/lib/analytics";
import { buildSourceBreakdown } from "@/db/analytics-queries";
import { isRefCode, normalizeRefCode, REF_ALPHABET, REF_LENGTH } from "@/lib/ref-code";

/**
 * site-scripts.tsx innehåller JSX, som vitest-konfigen inte transformerar. Vi
 * läser därför mallsträngen ur källfilen och evaluerar den som mall — samma
 * tolkning av escapes som i körningen.
 */
function loadBeacon(): string {
  const src = readFileSync(path.resolve(import.meta.dirname, "../../src/components/site/site-scripts.tsx"), "utf8");
  const m = /export const ANALYTICS = `([\s\S]*?)`;\n\nconst MOTION/.exec(src);
  if (!m) throw new Error("ANALYTICS hittades inte");
  return new Function("REF_ALPHABET", "REF_LENGTH", `return \`${m[1]}\``)(REF_ALPHABET, REF_LENGTH) as string;
}
const ANALYTICS = loadBeacon();

describe("ref-code", () => {
  it("godkänner giltiga koder och avvisar resten", () => {
    expect(isRefCode("K7Q2")).toBe(true);
    for (const bad of ["k7q2", "K7Q", "K7Q22", "K0Q2", "KIQ2", "KOQ2", "K1Q2", "KLQ2", "", null, 42]) {
      expect(isRefCode(bad)).toBe(false);
    }
    expect(REF_ALPHABET).toHaveLength(31);
  });

  it("normaliserar inmatning", () => {
    expect(normalizeRefCode(" k7q2 ")).toBe("K7Q2");
    expect(normalizeRefCode("ref k7q2")).toBe("K7Q2");
    expect(normalizeRefCode("(ref K7Q2)")).toBe("K7Q2");
    expect(normalizeRefCode("REFK7Q2")).toBe("K7Q2");
    expect(normalizeRefCode("K7 Q2")).toBe("K7Q2");
    expect(normalizeRefCode("hej")).toBeNull();
    expect(normalizeRefCode(undefined)).toBeNull();
  });
});

describe("eventRefCode (/api/ev)", () => {
  it("sparar bara för whatsapp_click med giltig kod", () => {
    expect(eventRefCode("whatsapp_click", "K7Q2")).toBe("K7Q2");
    expect(eventRefCode("whatsapp_click", "k7q2")).toBeNull();
    expect(eventRefCode("whatsapp_click", { x: 1 })).toBeNull();
    expect(eventRefCode("phone_click", "K7Q2")).toBeNull();
    expect(eventRefCode("page_view", "K7Q2")).toBeNull();
  });
});

describe("beacon", () => {
  it("är syntaktiskt giltig och ES5-lik", () => {
    expect(() => new Function(ANALYTICS)).not.toThrow();
    expect(ANALYTICS).not.toMatch(/=>|\blet\b|\bconst\b/);
  });

  function run(href: string) {
    let handler: ((e: unknown) => void) | undefined;
    const sent: string[] = [];
    const a: Record<string, unknown> = {
      tagName: "A",
      href,
      dataset: { ev: "whatsapp_click", evLoc: "hero" },
    };
    const target = { closest: () => a };
    const doc = {
      currentScript: { dataset: { bid: "1" } },
      referrer: "",
      addEventListener: (_t: string, fn: (e: unknown) => void) => (handler = fn),
      querySelectorAll: () => [],
    };
    class FakeBlob {
      constructor(public parts: string[]) {}
    }
    const nav = { sendBeacon: (_u: string, b: FakeBlob) => sent.push(b.parts[0]) };
    const win = { dataLayer: [], crypto: globalThis.crypto };
    const loc = { pathname: "/", hostname: "x.py" };
    new Function("window", "document", "navigator", "location", "Blob", ANALYTICS)(win, doc, nav, loc, FakeBlob);
    const click = () => handler!({ target });
    return { a, sent, click };
  }

  it("lägger ref-kod i wa.me-länkens text och skickar den som c", () => {
    const { a, sent, click } = run("https://wa.me/595981123456?text=Hola");
    click();
    const text = new URL(a.href as string).searchParams.get("text")!;
    const m = /^Hola \(ref ([A-Z0-9]{4})\)$/.exec(text);
    expect(m).not.toBeNull();
    expect(isRefCode(m![1])).toBe(true);
    expect(JSON.parse(sent[sent.length - 1]).c).toBe(m![1]);
  });

  it("ersätter gammal kod vid andra klick och skapar text vid behov", () => {
    const { a, click } = run("https://wa.me/595981123456");
    click();
    click();
    const text = new URL(a.href as string).searchParams.get("text")!;
    expect(text).toMatch(/^\(ref [A-Z0-9]{4}\)$/);
    expect(text.match(/\(ref /g)).toHaveLength(1);
  });

  it("rör inte andra länkar och kraschar inte på trasiga URL:er", () => {
    const other = run("https://example.com/?text=Hej");
    other.click();
    expect(other.a.href).toBe("https://example.com/?text=Hej");
    expect(JSON.parse(other.sent[other.sent.length - 1]).c).toBeUndefined();
    const broken = run("::nonsense::");
    expect(() => broken.click()).not.toThrow();
    expect(broken.sent.length).toBeGreaterThan(0);
  });
});

describe("buildSourceBreakdown", () => {
  it("klassar referrer-värdar och summerar visningar, klick och leads", () => {
    const rows = buildSourceBreakdown(
      [
        { host: "l.instagram.com", type: "page_view", n: 5 },
        { host: "instagram.com", type: "page_view", n: 3 },
        { host: "instagram.com", type: "whatsapp_click", n: 2 },
        { host: null, type: "page_view", n: 10 },
        { host: "www.google.com.py", type: "page_view", n: 4 },
        { host: "blogg.se", type: "page_view", n: 1 },
        { host: "x.com", type: "phone_click", n: 9 },
      ],
      [
        { source: "instagram", n: 1 },
        { source: null, n: 2 },
        { source: "weird", n: 1 },
      ],
    );
    expect(rows.map((r) => r.source)).toEqual(["directo", "instagram", "google", "otro"]);
    expect(rows[0]).toEqual({ source: "directo", views: 10, waClicks: 0, leads: 2 });
    expect(rows[1]).toEqual({ source: "instagram", views: 8, waClicks: 2, leads: 1 });
    expect(rows[3]).toEqual({ source: "otro", views: 1, waClicks: 0, leads: 1 });
  });

  it("ger tom lista utan data", () => {
    expect(buildSourceBreakdown([], [])).toEqual([]);
  });
});
