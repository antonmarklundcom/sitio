import { z } from "zod";

export const promoSettingsSchema = z.object({
  trialEnabled: z.boolean({ error: "Elegí si la promoción está activa." }),
  trialDays: z.number({ error: "Ingresá un número de días." }).int("Usá días enteros.").min(7, "Usá al menos 7 días.").max(90, "Usá hasta 90 días."),
  trialPlan: z.enum(["basico", "plus"], { error: "Elegí Básico o Plus." }),
  bannerText: z.string({ error: "Escribí el texto del banner." }).trim().max(140, "Usá hasta 140 caracteres."),
});
export type PromoSettings = z.infer<typeof promoSettingsSchema>;
export const DEFAULT_PROMO_SETTINGS: PromoSettings = {
  trialEnabled: false, trialDays: 30, trialPlan: "plus",
  bannerText: "Probá tu página gratis por tiempo limitado.",
};

/** Missing fields default; finite days clamp; invalid JSON and types throw. */
export function parsePromoSettings(json: string | null | undefined): PromoSettings {
  if (json == null) return { ...DEFAULT_PROMO_SETTINGS };
  const value: unknown = JSON.parse(json);
  const partial = promoSettingsSchema.partial().extend({ trialDays: z.number().finite().optional() }).parse(value);
  return promoSettingsSchema.parse({
    ...DEFAULT_PROMO_SETTINGS, ...partial,
    trialDays: partial.trialDays === undefined ? 30 : Math.max(7, Math.min(90, Math.trunc(partial.trialDays))),
  });
}
export async function getPromoSettings(): Promise<PromoSettings> {
  const { readSetting } = await import("@/db/settings-queries");
  return parsePromoSettings(await readSetting("promo"));
}
export async function savePromoSettings(settings: PromoSettings): Promise<void> {
  const valid = promoSettingsSchema.parse(settings);
  const { upsertSetting } = await import("@/db/settings-queries");
  await upsertSetting("promo", JSON.stringify(valid));
}
