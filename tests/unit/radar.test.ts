import { describe, expect, it } from "vitest";
import { computeUpsellScore, isHotLead, leadPitchMessage, LEAD_STAGES, type UpsellStats } from "@/lib/radar";

const base: UpsellStats = {
  waClicks30d: 0,
  views30d: 0,
  hasGalleryPhotos: false,
  hasMenuOrProducts: false,
  subscriptionActiveLongRemaining: false,
};

describe("computeUpsellScore", () => {
  it("ger 0 utan någon signal", () => {
    expect(computeUpsellScore(base)).toBe(0);
  });

  it("waClicks väger 0.5 per klick", () => {
    expect(computeUpsellScore({ ...base, waClicks30d: 40 })).toBe(20);
  });

  it("views väger 0.05 per besök", () => {
    expect(computeUpsellScore({ ...base, views30d: 1000 })).toBe(50);
  });

  it("galleri ger +10", () => {
    expect(computeUpsellScore({ ...base, hasGalleryPhotos: true })).toBe(10);
  });

  it("meny eller produkter ger +10", () => {
    expect(computeUpsellScore({ ...base, hasMenuOrProducts: true })).toBe(10);
  });

  it("betald prenumeration med god marginal ger +15", () => {
    expect(computeUpsellScore({ ...base, subscriptionActiveLongRemaining: true })).toBe(15);
  });

  it("summerar alla signaler", () => {
    expect(
      computeUpsellScore({
        waClicks30d: 10,
        views30d: 100,
        hasGalleryPhotos: true,
        hasMenuOrProducts: true,
        subscriptionActiveLongRemaining: true,
      }),
    ).toBe(5 + 5 + 10 + 10 + 15);
  });

  it("klampas till 100 även när summan är högre", () => {
    expect(
      computeUpsellScore({
        waClicks30d: 500,
        views30d: 5000,
        hasGalleryPhotos: true,
        hasMenuOrProducts: true,
        subscriptionActiveLongRemaining: true,
      }),
    ).toBe(100);
  });

  it("avrundar till närmaste heltal", () => {
    // 0.5 × 3 = 1.5 → 2
    expect(computeUpsellScore({ ...base, waClicks30d: 3 })).toBe(2);
  });
});

describe("isHotLead", () => {
  const thresholds = { waClicks30d: 15, views30d: 300 };

  it("flaggar vid waClicks-tröskeln exakt (≥)", () => {
    expect(isHotLead({ waClicks30d: 15, views30d: 0 }, thresholds)).toBe(true);
  });

  it("flaggar vid views-tröskeln exakt (≥)", () => {
    expect(isHotLead({ waClicks30d: 0, views30d: 300 }, thresholds)).toBe(true);
  });

  it("flaggar inte strax under båda trösklarna", () => {
    expect(isHotLead({ waClicks30d: 14, views30d: 299 }, thresholds)).toBe(false);
  });

  it("räcker med en av trösklarna", () => {
    expect(isHotLead({ waClicks30d: 0, views30d: 301 }, thresholds)).toBe(true);
  });
});

describe("leadPitchMessage", () => {
  it("bakar in 30-dagarssiffrorna när de finns", () => {
    const msg = leadPitchMessage({ businessName: "Taller López", views30d: 340, waClicks30d: 52 });
    expect(msg).toContain("Taller López");
    expect(msg).toMatch(/340 visitas/);
    expect(msg).toContain("52 contactos");
  });

  it("utelämnar statistikmeningen helt vid nollor", () => {
    const msg = leadPitchMessage({ businessName: "Taller López", views30d: 0, waClicks30d: 0 });
    expect(msg).not.toContain("visitas");
    expect(msg).toContain("Taller López");
  });

  it("tar med statistiken även om bara ett av måtten är över noll", () => {
    expect(leadPitchMessage({ businessName: "X", views30d: 0, waClicks30d: 3 })).toContain("contactos");
  });
});

describe("LEAD_STAGES", () => {
  it("matchar schemats mysqlEnum, i ordning", () => {
    expect(LEAD_STAGES).toEqual(["ninguno", "contactado", "cotizado", "vendido"]);
  });
});
