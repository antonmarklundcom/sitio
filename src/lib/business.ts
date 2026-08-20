import { z } from "zod";
import { normalizePyPhone } from "./format";
import { validateSlug } from "./slug";

export const CATEGORIES = [
  "comercio",
  "servicios",
  "gastronomia",
  "salud",
  "belleza",
  "taller",
  "otro",
] as const;

export const THEME_KEYS = [
  "comercio",
  "servicios",
  "gastronomia",
  "salud",
  "belleza",
  "taller",
] as const;

export const BUSINESS_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "paused",
  "archived",
] as const;

export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  comercio: "Comercio / butik",
  servicios: "Servicios / hantverk",
  gastronomia: "Gastronomía / mat",
  salud: "Salud / vård",
  belleza: "Belleza / skönhet",
  taller: "Taller / verkstad",
  otro: "Otro",
};

export const THEME_LABELS: Record<(typeof THEME_KEYS)[number], string> = {
  comercio: "comercio — ljus, produktkort",
  servicios: "servicios — mörk hero, hög kontrast",
  gastronomia: "gastronomia — varm, bildtung",
  salud: "salud — lugn, förtroende",
  belleza: "belleza — mjuk, galleri",
  taller: "taller — robust, direktkontakt",
};

export const STATUS_LABELS: Record<BusinessStatus, string> = {
  draft: "Utkast",
  pending_review: "Väntar granskning",
  published: "Publicerad",
  paused: "Pausad",
  archived: "Arkiverad",
};

/**
 * Tillåtna statusövergångar. Publicering kräver dessutom att sajten är
 * komplett — se assertPublishable().
 */
export const STATUS_TRANSITIONS: Record<BusinessStatus, BusinessStatus[]> = {
  draft: ["pending_review", "published", "archived"],
  pending_review: ["draft", "published", "archived"],
  published: ["paused", "archived"],
  paused: ["published", "archived"],
  archived: ["draft"],
};

export function canTransition(from: BusinessStatus, to: BusinessStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const WEEKDAYS = [
  { key: "mon", label: "Måndag", short: "Lun" },
  { key: "tue", label: "Tisdag", short: "Mar" },
  { key: "wed", label: "Onsdag", short: "Mié" },
  { key: "thu", label: "Torsdag", short: "Jue" },
  { key: "fri", label: "Fredag", short: "Vie" },
  { key: "sat", label: "Lördag", short: "Sáb" },
  { key: "sun", label: "Söndag", short: "Dom" },
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];
export type HoursInterval = { open: string; close: string };
export type HoursMap = Record<string, HoursInterval[] | null>;

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizePyPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Ogiltigt paraguayanskt telefonnummer." });
      return z.NEVER;
    }
    return normalized;
  });

const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const normalized = normalizePyPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Ogiltigt sekundärt telefonnummer." });
      return z.NEVER;
    }
    return normalized;
  });

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^https?:\/\/\S+$/.test(v), "Måste vara en fullständig URL (https://…).");

const emptyToNull = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Max ${max} tecken.`)
    .transform((v) => (v === "" ? null : v));

export const hoursSchema = z.record(
  z.string(),
  z
    .array(
      z
        .object({ open: z.string().regex(timeRe, "Tid måste vara HH:MM."), close: z.string().regex(timeRe, "Tid måste vara HH:MM.") })
        .refine((i) => i.open < i.close, "Stängningstiden måste vara efter öppningstiden."),
    )
    .nullable(),
);

export const servicesSchema = z.array(
  z.object({
    name: z.string().trim().min(1).max(80),
    desc: z.string().trim().max(200).optional(),
  }),
);

export const businessFormSchema = z.object({
  name: z.string().trim().min(2, "Namn krävs.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v, ctx) => {
      const result = validateSlug(v);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: result.error });
        return z.NEVER;
      }
      return result.slug;
    }),
  category: z.enum(CATEGORIES),
  themeKey: z.enum(THEME_KEYS),
  paletteVariant: z.coerce.number().int().min(1).max(4),
  rawDescription: emptyToNull(2000),
  description: emptyToNull(2000),
  servicesJson: servicesSchema,
  whatsappPhone: phoneSchema,
  secondaryPhone: optionalPhoneSchema,
  address: emptyToNull(200),
  zone: emptyToNull(80),
  city: z.string().trim().min(1, "Stad krävs.").max(80),
  lat: emptyToNull(20),
  lng: emptyToNull(20),
  mapsUrl: optionalUrl,
  socialsJson: z.object({
    instagram: optionalUrl.nullable().optional(),
    facebook: optionalUrl.nullable().optional(),
    tiktok: optionalUrl.nullable().optional(),
  }),
  hoursJson: hoursSchema,
  ruc: emptyToNull(20),
  seoTitle: emptyToNull(70),
  seoDescription: emptyToNull(160),
  adminNotes: emptyToNull(2000),
});

export type BusinessFormValues = z.infer<typeof businessFormSchema>;

/**
 * Vad som måste finnas innan en sajt får gå live. Publicerar man en tom sajt
 * hamnar den i Googles index som tunn sida — den kontrollen är inte kosmetisk.
 */
export function publishBlockers(
  b: {
    description: string | null;
    servicesJson: unknown;
    whatsappPhone: string | null;
    whatsappVerifiedAt: Date | null;
    city: string | null;
    seoDescription: string | null;
  },
  photoCount = 1,
): string[] {
  const blockers: string[] = [];
  const services = Array.isArray(b.servicesJson) ? b.servicesJson : [];

  if (!b.description || b.description.trim().length < 80)
    blockers.push("Beskrivningen måste vara minst 80 tecken (tunt innehåll rankar inte).");
  if (services.length < 2) blockers.push("Minst två tjänster krävs.");
  if (!b.whatsappPhone) blockers.push("WhatsApp-nummer saknas.");
  if (!b.whatsappVerifiedAt) blockers.push("WhatsApp-numret är inte verifierat.");
  if (!b.city) blockers.push("Stad saknas (behövs för LocalBusiness-schema).");
  if (!b.seoDescription) blockers.push("SEO-beskrivning saknas.");
  // Utan bild står hero-ytan tom och sajten ser billigare ut än den är.
  if (photoCount < 1) blockers.push("Minst ett foto krävs (hero-ytan står annars tom).");

  return blockers;
}

/** Parsar hours-fälten från ett FormData-formulär till HoursMap. */
export function hoursFromFormData(formData: FormData): HoursMap {
  const hours: HoursMap = {};
  for (const { key } of WEEKDAYS) {
    if (formData.get(`hours.${key}.closed`) === "on") {
      hours[key] = null;
      continue;
    }
    const intervals: HoursInterval[] = [];
    for (let i = 0; i < 2; i += 1) {
      const open = String(formData.get(`hours.${key}.${i}.open`) ?? "").trim();
      const close = String(formData.get(`hours.${key}.${i}.close`) ?? "").trim();
      if (open && close) intervals.push({ open, close });
    }
    hours[key] = intervals.length > 0 ? intervals : null;
  }
  return hours;
}

/** Parsar services-raderna från formuläret. */
export function servicesFromFormData(formData: FormData): { name: string; desc?: string }[] {
  const names = formData.getAll("service.name").map(String);
  const descs = formData.getAll("service.desc").map(String);
  return names
    .map((name, i) => ({ name: name.trim(), desc: descs[i]?.trim() || undefined }))
    .filter((s) => s.name.length > 0);
}
