import { describe, expect, it } from "vitest";
import { FAQS, faqJsonLd, organizationJsonLd } from "@/components/landing/content";
import { salesContact } from "@/components/landing/sales-contact";

/**
 * Landningssidan har ingen logik att testa (plan.md §5.2) — utom den
 * strukturerade datan, som Google läser och ingen människa granskar.
 * Testerna går på dataarrayerna, aldrig på DOM:en.
 */
describe("FAQ-JSON-LD", () => {
  const ld = faqJsonLd();

  it("är en FAQPage med exakt fem Question", () => {
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(5);
    expect(ld.mainEntity.every((q) => q["@type"] === "Question")).toBe(true);
  });

  it("bär varje fråga och svar ur FAQS, med icke-tomma svar", () => {
    expect(ld.mainEntity.map((q) => q.name)).toEqual(FAQS.map((f) => f.q));
    for (const q of ld.mainEntity) {
      expect(q.acceptedAnswer["@type"]).toBe("Answer");
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(20);
    }
  });
});

describe("Organization-JSON-LD", () => {
  it("bär kanonisk URL och säljnumret när det finns", () => {
    const ld = organizationJsonLd("https://sitio.com.py/", "+595981123456");
    expect(ld["@type"]).toBe("Organization");
    expect(ld.url).toBe("https://sitio.com.py/");
    expect(ld.contactPoint?.[0].telephone).toBe("+595981123456");
  });

  it("utelämnar contactPoint helt när numret saknas", () => {
    const ld = organizationJsonLd("https://sitio.com.py/", null);
    expect("contactPoint" in ld).toBe(false);
  });
});

describe("salesContact", () => {
  it("bygger en wa.me-länk med förifyllt meddelande ur ett PY-nummer", () => {
    const c = salesContact("0981 123 456");
    expect(c.e164).toBe("+595981123456");
    expect(c.href.startsWith("https://wa.me/595981123456?text=")).toBe(true);
    expect(c.display).toBe("+595 981 123 456");
  });

  it("faller tillbaka på #contacto när numret saknas eller är trasigt", () => {
    for (const raw of ["", "   ", "123", "no es un número"]) {
      expect(salesContact(raw)).toEqual({ href: "#contacto", e164: null, display: null });
    }
  });
});
