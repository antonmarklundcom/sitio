import { describe, expect, it } from "vitest";
import { DEFAULT_PROMO_SETTINGS, parsePromoSettings, promoSettingsSchema } from "@/lib/settings";
describe("parsePromoSettings", () => {
  it("defaults missing rows and fields", () => {
    for (const value of [null, undefined, "{}"]) expect(parsePromoSettings(value)).toEqual(DEFAULT_PROMO_SETTINGS);
    expect(parsePromoSettings('{"trialEnabled":true}').trialDays).toBe(30);
  });
  it.each([[1, 7], [100, 90], [14.9, 14], [7, 7], [90, 90]])("clamps %s to %s", (input, days) => {
    expect(parsePromoSettings(JSON.stringify({ trialDays: input })).trialDays).toBe(days);
  });
  it("round trips valid settings and trims text", () => {
    expect(parsePromoSettings(JSON.stringify({ trialEnabled: true, trialDays: 14, trialPlan: "basico", bannerText: " Hola " }))).toEqual({ trialEnabled: true, trialDays: 14, trialPlan: "basico", bannerText: "Hola" });
  });
  it.each(['bad', 'null', '[]', 'true', '{"trialEnabled":"false"}', '{"trialDays":"14"}', '{"trialDays":null}', '{"trialDays":1e400}', '{"trialPlan":"pro"}', '{"bannerText":false}', JSON.stringify({ bannerText: "x".repeat(141) })])("rejects %s", value => {
    expect(() => parsePromoSettings(value)).toThrow();
  });
  it("accepts 140 characters; admin validation rejects out-of-range days", () => {
    expect(parsePromoSettings(JSON.stringify({ bannerText: "x".repeat(140) })).bannerText).toHaveLength(140);
    for (const trialDays of [6, 91, 14.5, NaN]) expect(promoSettingsSchema.safeParse({ ...DEFAULT_PROMO_SETTINGS, trialDays }).success).toBe(false);
  });
});
