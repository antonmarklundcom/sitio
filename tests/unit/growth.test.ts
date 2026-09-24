import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROWTH_SETTINGS,
  DEFAULT_UPSELL_CATALOG,
  commissionGs,
  isGoogleReviewUrl,
  leadReplyMessage,
  monthlyStatsMessage,
  newReferralCode,
  normalizeRefCode,
  parseGrowthSettings,
  parseUpsellCatalog,
  previousMonth,
  recommendedServiceKey,
  renewalStage,
  siteLeadSchema,
  siteOptions,
  turnoDayProblem,
  visitorWhatsappMessage,
} from "@/lib/growth";

describe("siteOptions", () => {
  it("defaultar formulär och recensionsknapp på, kredit av (D4)", () => {
    expect(siteOptions(null)).toEqual({ leadForm: true, reviewButton: true, credit: false });
  });
  it("respekterar sparade val och ignorerar skräp", () => {
    expect(siteOptions({ leadForm: false, credit: true })).toEqual({ leadForm: false, reviewButton: true, credit: true });
    expect(siteOptions({ leadForm: "no" as unknown as boolean })).toEqual(siteOptions(null));
  });
});

describe("isGoogleReviewUrl", () => {
  it("släpper bara igenom https till Googles värdar", () => {
    expect(isGoogleReviewUrl("https://g.page/r/abc123/review")).toBe(true);
    expect(isGoogleReviewUrl("https://search.google.com/local/writereview?placeid=X")).toBe(true);
    expect(isGoogleReviewUrl("http://g.page/r/abc/review")).toBe(false);
    expect(isGoogleReviewUrl("https://g.page.evil.com/r")).toBe(false);
    expect(isGoogleReviewUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("siteLeadSchema", () => {
  it("normaliserar numret och kräver ett meddelande för en consulta", () => {
    const ok = siteLeadSchema.safeParse({ name: "Ana", phone: "0981 123 456", message: "Precio?" });
    expect(ok.success && ok.data.phone).toBe("+595981123456");
    const bad = siteLeadSchema.safeParse({ name: "Ana", phone: "0981123456", message: "" });
    expect(bad.success).toBe(false);
  });
  it("turno kräver dag men inte meddelande, och validerar klockslag", () => {
    expect(siteLeadSchema.safeParse({ kind: "turno", name: "Ana", phone: "0981123456", day: "2026-10-01" }).success).toBe(true);
    expect(siteLeadSchema.safeParse({ kind: "turno", name: "Ana", phone: "0981123456" }).success).toBe(false);
    expect(siteLeadSchema.safeParse({ kind: "turno", name: "Ana", phone: "0981123456", day: "2026-10-01", time: "25:00" }).success).toBe(false);
  });
  it("avvisar ett utländskt/felaktigt nummer", () => {
    expect(siteLeadSchema.safeParse({ name: "Ana", phone: "123", message: "hola" }).success).toBe(false);
  });
});

describe("turnoDayProblem", () => {
  it("bakåt i tiden och mer än 90 dagar fram är fel", () => {
    expect(turnoDayProblem("2026-09-23", "2026-09-24")).toMatch(/hoy en adelante/);
    expect(turnoDayProblem("2026-09-24", "2026-09-24")).toBeNull();
    expect(turnoDayProblem("2026-12-23", "2026-09-24")).toBeNull();
    expect(turnoDayProblem("2026-12-24", "2026-09-24")).toMatch(/3 meses/);
  });
});

describe("meddelandetexter", () => {
  it("ägarens svar nämner turnon med datum", () => {
    const text = leadReplyMessage({ name: "Ana López", kind: "turno", serviceName: "Corte", requestedDay: "2026-10-01", requestedTime: "10:30" }, "Peluquería Sol");
    expect(text).toBe("Hola Ana! Te escribo de Peluquería Sol por tu pedido de turno para Corte el 01/10/2026 a las 10:30.");
  });
  it("besökarens egen text för en consulta", () => {
    expect(visitorWhatsappMessage({ kind: "consulta", name: "Ana", message: "¿Precio?", service: "", day: "", time: "" })).toBe("Hola! Soy Ana. ¿Precio?");
  });
  it("månadsmeddelandet utelämnar consultas när de är noll", () => {
    const base = { businessName: "X", monthLabel: "agosto", views: 1200, waClicks: 40, panelUrl: "https://s/mi-sitio" };
    expect(monthlyStatsMessage({ ...base, leads: 0 })).not.toMatch(/formulario/);
    expect(monthlyStatsMessage({ ...base, leads: 3 })).toMatch(/3 consultas por el formulario/);
    expect(monthlyStatsMessage({ ...base, leads: 0 })).toMatch(/1\.200 visitas/);
  });
});

describe("värvning och provision", () => {
  it("koden är sex läsbara tecken och deterministisk med given slump", () => {
    expect(newReferralCode("", () => 0)).toBe("AAAAAA");
    expect(newReferralCode("ANA", () => 0.999, 4)).toBe("ANA9999");
    expect(newReferralCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
  it("normalizeRefCode godtar bara kodtecken", () => {
    expect(normalizeRefCode(" ab12cd ")).toBe("AB12CD");
    expect(normalizeRefCode("x")).toBeNull();
    expect(normalizeRefCode("AB-12")).toBeNull();
    expect(normalizeRefCode(null)).toBeNull();
  });
  it("provisionen avrundas nedåt och klampas", () => {
    expect(commissionGs(300_000, 30)).toBe(90_000);
    expect(commissionGs(333_333, 30)).toBe(99_999);
    expect(commissionGs(300_000, 150)).toBe(300_000);
    expect(commissionGs(-5, 30)).toBe(0);
  });
});

describe("inställningar och katalog", () => {
  it("saknade fält får default, trasiga fält ignoreras", () => {
    expect(parseGrowthSettings(null)).toEqual(DEFAULT_GROWTH_SETTINGS);
    expect(parseGrowthSettings('{"autoPublish":true}').autoPublish).toBe(true);
    expect(parseGrowthSettings('{"referralRewardDays":-4}')).toEqual(DEFAULT_GROWTH_SETTINGS);
  });
  it("katalogen faller tillbaka på startkatalogen", () => {
    expect(parseUpsellCatalog(null)).toEqual(DEFAULT_UPSELL_CATALOG);
    expect(parseUpsellCatalog('[{"key":"BAD KEY"}]')).toEqual(DEFAULT_UPSELL_CATALOG);
    expect(parseUpsellCatalog("[]")).toEqual([]);
  });
  it("rekommendationen följer siffrorna", () => {
    expect(recommendedServiceKey({ views30: 20, waClicks30: 1 })).toBe("google");
    expect(recommendedServiceKey({ views30: 500, waClicks30: 40 })).toBe("crm");
    expect(recommendedServiceKey({ views30: 500, waClicks30: 5 })).toBe("web");
    expect(recommendedServiceKey({ views30: 300, waClicks30: 12 })).toBe("anuncios");
  });
});

describe("meddelandekön", () => {
  it("förnyelsesteg per dagar kvar", () => {
    expect(renewalStage(45)).toBeNull();
    expect(renewalStage(30)).toBe("renewal_30");
    expect(renewalStage(16)).toBe("renewal_30");
    expect(renewalStage(15)).toBe("renewal_15");
    expect(renewalStage(7)).toBe("renewal_7");
    expect(renewalStage(0)).toBe("renewal_7");
    expect(renewalStage(-1)).toBe("renewal_overdue");
  });
  it("förra månaden, även över årsskiftet", () => {
    expect(previousMonth("2026-09-24")).toEqual({ key: "2026-08", label: "agosto", start: "2026-08-01", end: "2026-08-31" });
    expect(previousMonth("2027-01-02")).toEqual({ key: "2026-12", label: "diciembre", start: "2026-12-01", end: "2026-12-31" });
    expect(previousMonth("2028-03-01").end).toBe("2028-02-29");
  });
});
