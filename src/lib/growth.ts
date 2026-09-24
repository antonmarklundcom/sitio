/**
 * Tillväxtpaketet (growth-1, docs/log/growth-1.md): consultas från kundsajten,
 * kundens egna av/på-val, värvning, säljare på provision, tjänstekatalogen i
 * owner-panelen, meddelandekön och autopublicering.
 *
 * Bara rena funktioner och scheman här — ingen databas, inga Node-moduler —
 * så att allt går att enhetstesta och att klientformuläret kan dela schemat.
 * DB-delen ligger i src/db/growth-queries.ts.
 */
import { z } from "zod";
import { normalizePyPhone } from "./format";

// ---------- kundens av/på-val för den publika sajten ----------

export type SiteOptions = { leadForm: boolean; reviewButton: boolean; credit: boolean };

/**
 * Default: formuläret och recensionsknappen på (knappen syns ändå bara när en
 * länk finns), "Hecho con sitio.com.py" av — D4 säger att krediten aldrig är
 * på utan att kunden själv valt den.
 */
export const DEFAULT_SITE_OPTIONS: SiteOptions = { leadForm: true, reviewButton: true, credit: false };

export function siteOptions(json: Partial<SiteOptions> | null | undefined): SiteOptions {
  const raw = json && typeof json === "object" ? json : {};
  return {
    leadForm: typeof raw.leadForm === "boolean" ? raw.leadForm : DEFAULT_SITE_OPTIONS.leadForm,
    reviewButton: typeof raw.reviewButton === "boolean" ? raw.reviewButton : DEFAULT_SITE_OPTIONS.reviewButton,
    credit: typeof raw.credit === "boolean" ? raw.credit : DEFAULT_SITE_OPTIONS.credit,
  };
}

/**
 * Googles recensionslänk. Bara https till Googles egna värdar: knappen sitter
 * på kundens sajt, och en fri länk där vore en phishing-yta.
 */
const REVIEW_HOSTS = ["g.page", "search.google.com", "www.google.com", "google.com", "maps.app.goo.gl", "goo.gl", "www.google.com.py", "google.com.py", "maps.google.com"];

export function isGoogleReviewUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && REVIEW_HOSTS.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

// ---------- consultas från kundsajten ----------

export const LEAD_LIMITS = { name: 80, message: 600, service: 120 } as const;

const phoneField = z
  .string({ error: "Escribí tu número de WhatsApp." })
  .trim()
  .transform((value, ctx) => {
    const phone = normalizePyPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Escribí un número paraguayo. Ej: 0981 123 456" });
      return z.NEVER;
    }
    return phone;
  });

export const siteLeadSchema = z
  .object({
    kind: z.enum(["consulta", "turno"]).default("consulta"),
    name: z
      .string({ error: "Escribí tu nombre." })
      .trim()
      .min(2, "Escribí tu nombre.")
      .max(LEAD_LIMITS.name, `Usá hasta ${LEAD_LIMITS.name} caracteres.`),
    phone: phoneField,
    message: z.string().trim().max(LEAD_LIMITS.message, `Usá hasta ${LEAD_LIMITS.message} caracteres.`).default(""),
    service: z.string().trim().max(LEAD_LIMITS.service).default(""),
    day: z
      .string()
      .trim()
      .default("")
      .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Elegí un día."),
    time: z
      .string()
      .trim()
      .default("")
      .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Elegí una hora."),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "consulta" && value.message.length < 3) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Contanos qué necesitás." });
    }
    if (value.kind === "turno" && value.day === "") {
      ctx.addIssue({ code: "custom", path: ["day"], message: "Elegí un día." });
    }
  });
export type SiteLeadInput = z.infer<typeof siteLeadSchema>;

/** Ett turnodatum får inte ligga bakåt i tiden eller mer än 90 dagar fram. */
export function turnoDayProblem(day: string, today: string): string | null {
  if (day === "") return null;
  if (day < today) return "Elegí un día de hoy en adelante.";
  const max = new Date(`${today}T00:00:00Z`);
  max.setUTCDate(max.getUTCDate() + 90);
  if (day > max.toISOString().slice(0, 10)) return "Elegí un día dentro de los próximos 3 meses.";
  return null;
}

/** Dd/mm/åååå för visning — samma format som resten av kundens yta. */
export function dayEs(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** Ägarens svar till besökaren — förifylld wa.me-text. */
export function leadReplyMessage(lead: {
  name: string;
  kind: "consulta" | "turno";
  serviceName?: string | null;
  requestedDay?: string | null;
  requestedTime?: string | null;
}, businessName: string): string {
  const first = lead.name.split(/\s+/)[0] ?? lead.name;
  if (lead.kind === "turno") {
    const what = lead.serviceName ? ` para ${lead.serviceName}` : "";
    const when = lead.requestedDay ? ` el ${dayEs(lead.requestedDay)}${lead.requestedTime ? ` a las ${lead.requestedTime}` : ""}` : "";
    return `Hola ${first}! Te escribo de ${businessName} por tu pedido de turno${what}${when}.`;
  }
  return `Hola ${first}! Te escribo de ${businessName} por la consulta que dejaste en nuestra página.`;
}

/** Besökarens egen WhatsApp-text efter att formuläret skickats. */
export function visitorWhatsappMessage(input: Pick<SiteLeadInput, "kind" | "name" | "message" | "service" | "day" | "time">): string {
  if (input.kind === "turno") {
    const what = input.service ? ` para ${input.service}` : "";
    const when = input.day ? ` el ${dayEs(input.day)}${input.time ? ` a las ${input.time}` : ""}` : "";
    return `Hola! Soy ${input.name}. Quiero pedir un turno${what}${when}.`;
  }
  return `Hola! Soy ${input.name}. ${input.message}`.trim();
}

// ---------- värvning och säljare ----------

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // utan 0/O, 1/I

/** Kort, läsbar kod för /registro?ref=. `random` är injicerbar för testerna. */
export function newReferralCode(prefix = "", random: () => number = Math.random, length = 6): string {
  let out = prefix;
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return out;
}

/** ?ref= som den kommer in: versaler, bara kodtecken, annars null. */
export function normalizeRefCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(code) ? code : null;
}

/** Provision i heltals-Gs, avrundad nedåt — hellre en guaraní för lite. */
export function commissionGs(amountGs: number, pct: number): number {
  if (!Number.isFinite(amountGs) || amountGs <= 0) return 0;
  const p = Math.max(0, Math.min(100, Math.trunc(pct)));
  return Math.floor((amountGs * p) / 100);
}

/** Värvningstexten kunden delar på WhatsApp. */
export function referralShareMessage(link: string, rewardDays: number): string {
  const bonus = rewardDays > 0 ? ` Si la creás con este enlace, tenés ${rewardDays} días extra gratis.` : "";
  return `Hola! Yo tengo mi página en sitio.com.py y me escriben más clientes por WhatsApp. Hacé la tuya acá: ${link}${bonus}`;
}

// ---------- inställningar (settings-tabellen, nyckel "growth") ----------

export const growthSettingsSchema = z.object({
  /** Dagar som den som värvade får på sin plan när den värvade betalar första gången. */
  referralRewardDays: z.number().int().min(0).max(365),
  /** Dagar extra för den som blev värvad, på samma betalning. */
  referredBonusDays: z.number().int().min(0).max(365),
  /** Default-provision för nya säljare (procent av första årets betalning). */
  partnerCommissionPct: z.number().int().min(0).max(100),
  /** Inlämnat intake ⇒ AI-puts + publicering direkt, granskning efteråt. */
  autoPublish: z.boolean(),
});
export type GrowthSettings = z.infer<typeof growthSettingsSchema>;
export const DEFAULT_GROWTH_SETTINGS: GrowthSettings = {
  referralRewardDays: 30,
  referredBonusDays: 30,
  partnerCommissionPct: 30,
  autoPublish: false,
};

export function parseGrowthSettings(json: string | null | undefined): GrowthSettings {
  if (json == null) return { ...DEFAULT_GROWTH_SETTINGS };
  const partial = growthSettingsSchema.partial().safeParse(JSON.parse(json));
  return { ...DEFAULT_GROWTH_SETTINGS, ...(partial.success ? partial.data : {}) };
}

// ---------- tjänstekatalogen i owner-panelen ----------

export const upsellServiceSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "Clave: minúsculas, números y guiones."),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().max(300),
  price: z.string().trim().max(60),
  enabled: z.boolean(),
});
export type UpsellService = z.infer<typeof upsellServiceSchema>;
export const upsellCatalogSchema = z.array(upsellServiceSchema).max(12);

/** Startkatalogen. Priserna lämnas tomma med flit — du sätter dem i /admin/crecimiento. */
export const DEFAULT_UPSELL_CATALOG: UpsellService[] = [
  {
    key: "google",
    title: "Aparecé primero en Google Maps",
    body: "Armamos y optimizamos tu perfil de Google: categorías, fotos, horarios y reseñas, para que te encuentren los que buscan cerca.",
    price: "",
    enabled: true,
  },
  {
    key: "anuncios",
    title: "Anuncios en Instagram y Facebook",
    body: "Campañas que llevan clientes directo a tu WhatsApp. Vos atendés, nosotros traemos las consultas.",
    price: "",
    enabled: true,
  },
  {
    key: "web",
    title: "Página web completa con tu dominio",
    body: "Un sitio a medida en tunegocio.com.py, con varias páginas, blog o tienda.",
    price: "",
    enabled: true,
  },
  {
    key: "crm",
    title: "Ordená tus clientes (CRM)",
    body: "Todas tus consultas en un solo lugar, con seguimiento y recordatorios para que ninguna venta se pierda.",
    price: "",
    enabled: true,
  },
  {
    key: "whatsapp-bot",
    title: "Respuestas automáticas en WhatsApp",
    body: "Catálogo, preguntas frecuentes y turnos que se contestan solos, las 24 horas.",
    price: "",
    enabled: true,
  },
  {
    key: "contenido",
    title: "Fotos y videos para tus redes",
    body: "Contenido profesional para Instagram y TikTok que muestra tu negocio como es.",
    price: "",
    enabled: true,
  },
];

export function parseUpsellCatalog(json: string | null | undefined): UpsellService[] {
  if (json == null) return DEFAULT_UPSELL_CATALOG.map((s) => ({ ...s }));
  const parsed = upsellCatalogSchema.safeParse(JSON.parse(json));
  return parsed.success ? parsed.data : DEFAULT_UPSELL_CATALOG.map((s) => ({ ...s }));
}

/**
 * Vilken tjänst panelen lyfter som "Recomendado para vos", utifrån 30 dagars
 * siffror. Lite trafik ⇒ bli hittad (Google). Trafik men få klick ⇒ annonser
 * säljer inte det problemet; bättre sajt. Många klick ⇒ ordning (CRM).
 */
export function recommendedServiceKey(stats: { views30: number; waClicks30: number }): string {
  if (stats.views30 < 100) return "google";
  if (stats.waClicks30 >= 20) return "crm";
  if (stats.waClicks30 / Math.max(1, stats.views30) < 0.03) return "web";
  return "anuncios";
}

/** Planuppgraderingen visas som ett eget kort; nyckeln finns inte i katalogen. */
export const PLAN_UPGRADE_KEY = "plan-plus";

/** Texten till dig när en kund trycker "Me interesa". */
export function serviceInterestMessage(businessName: string, serviceTitle: string): string {
  return `Hola! Soy de ${businessName} (sitio.com.py). Me interesa: ${serviceTitle}. ¿Me contás más?`;
}

// ---------- meddelandekön ----------

export type RenewalStage = "renewal_30" | "renewal_15" | "renewal_7" | "renewal_overdue";

/**
 * Påminnelsesteget för ett antal dagar kvar. Varje steg skickas en gång per
 * period; missas 30-dagars ligger 15 kvar när den dagen kommer.
 */
export function renewalStage(daysLeft: number): RenewalStage | null {
  if (daysLeft < 0) return "renewal_overdue";
  if (daysLeft <= 7) return "renewal_7";
  if (daysLeft <= 15) return "renewal_15";
  if (daysLeft <= 30) return "renewal_30";
  return null;
}

export const MESSAGE_KIND_LABELS: Record<string, string> = {
  monthly_stats: "Cifras del mes",
  renewal_30: "Renovación · 30 días",
  renewal_15: "Renovación · 15 días",
  renewal_7: "Renovación · 7 días",
  renewal_overdue: "Renovación · vencida",
};

/** Periodnyckeln för en förnyelsepåminnelse: en ny period ⇒ nya påminnelser. */
export function renewalPeriodKey(subscriptionId: number, expiresAt: string): string {
  return `${subscriptionId}:${expiresAt}`;
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Förra månadens nyckel ("YYYY-MM") och namn, räknat från Asunción-dagen. */
export function previousMonth(today: string): { key: string; label: string; start: string; end: string } {
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 2, 1));
  const last = new Date(Date.UTC(y, m - 1, 0));
  const key = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    key,
    label: MONTHS_ES[first.getUTCMonth()],
    start: first.toISOString().slice(0, 10),
    end: last.toISOString().slice(0, 10),
  };
}

/** Månadsmeddelandet. Siffrorna skickas in, aldrig gissade; noll-rader skickas inte alls. */
export function monthlyStatsMessage(params: {
  businessName: string;
  monthLabel: string;
  views: number;
  waClicks: number;
  leads: number;
  panelUrl: string;
}): string {
  const nf = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });
  const leads = params.leads > 0 ? ` y ${nf.format(params.leads)} consultas por el formulario` : "";
  return (
    `Hola ${params.businessName}! Te cuento cómo le fue a tu página en ${params.monthLabel}: ` +
    `${nf.format(params.views)} visitas, ${nf.format(params.waClicks)} contactos por WhatsApp${leads} 📈. ` +
    `Mirá el detalle en ${params.panelUrl} . ¿Querés que te ayudemos a conseguir todavía más clientes?`
  );
}
