import { z } from "zod";
import { normalizePyPhone } from "./format";
import { normalizeIntervals } from "./hours";
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
  comercio: "Comercio",
  servicios: "Servicios",
  gastronomia: "Gastronomía",
  salud: "Salud",
  belleza: "Belleza",
  taller: "Taller",
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
  draft: "Borrador",
  pending_review: "Pendiente de revisión",
  published: "Publicada",
  paused: "Pausada",
  archived: "Archivada",
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
  { key: "mon", label: "Lunes", short: "Lun" },
  { key: "tue", label: "Martes", short: "Mar" },
  { key: "wed", label: "Miércoles", short: "Mié" },
  { key: "thu", label: "Jueves", short: "Jue" },
  { key: "fri", label: "Viernes", short: "Vie" },
  { key: "sat", label: "Sábado", short: "Sáb" },
  { key: "sun", label: "Domingo", short: "Dom" },
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
        // "00:00" som stängning är midnatt (samma regel som normalizeIntervals).
        .refine((i) => i.close === "00:00" || i.open < i.close, "Stängningstiden måste vara efter öppningstiden."),
    )
    .nullable(),
);

// Samma gränser som intaken och ägarpanelen (120/300): adminet måste kunna
// spara det kunden skrev (R3-39).
export const servicesSchema = z.array(
  z.object({
    name: z.string().trim().min(1, "Namn krävs.").max(120, "Max 120 tecken."),
    desc: z.string().trim().max(300, "Max 300 tecken.").optional(),
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
  // themeKey och paletteVariant ligger INTE här: de kommer aldrig från
  // formuläret. Servern härleder dem ur branschen (presentationFor,
  // src/lib/presentation.ts, plan §1.11) på varje skrivväg.
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

/**
 * Zod-felen från adminets formulär som ett fält → meddelande-objekt (R3-39).
 * Nästlade fel (`servicesJson.0.name`, `hoursJson.fri.0`) samlas under
 * `servicesJson` resp. `hoursJson` med vilken rad det gäller, annars visas de
 * aldrig: formuläret har inget fält som heter `servicesJson.0.name`.
 */
export function businessFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
  services: { name: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String);
    let key = path.join(".") || "_";
    let message = issue.message;
    if (path[0] === "servicesJson" && path.length > 1) {
      const i = Number(path[1]);
      const name = services[i]?.name ?? "";
      const short = name.length > 30 ? `${name.slice(0, 30)}…` : name;
      key = "servicesJson";
      message = `Servicio ${i + 1}${short ? ` («${short}»)` : ""}: ${message}`;
    } else if (path[0] === "hoursJson" && path.length > 1) {
      const day = WEEKDAYS.find((d) => d.key === path[1]);
      key = "hoursJson";
      message = `${day?.label ?? path[1]}: ${message}`;
    }
    out[key] ??= message;
  }
  return out;
}

/** Parsar hours-fälten från ett FormData-formulär till HoursMap. */
export function hoursFromFormData(formData: FormData): HoursMap {
  const hours: HoursMap = {};
  for (const { key } of WEEKDAYS) {
    if (formData.get(`hours.${key}.closed`) === "on") {
      hours[key] = null;
      continue;
    }
    // Samma städning som intaken och ägarpanelen (R3-19, R3-28): felformade
    // tider faller bort, 00:00 som stängning är midnatt, överlapp slås ihop.
    const intervals = normalizeIntervals(
      [0, 1].map((i) => ({
        open: String(formData.get(`hours.${key}.${i}.open`) ?? ""),
        close: String(formData.get(`hours.${key}.${i}.close`) ?? ""),
      })),
    );
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
