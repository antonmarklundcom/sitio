import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env";
import { normalizePyPhone } from "./format";

/**
 * Intake (PLAN.md §1.3 A + PR-10): superadmin skapar ett utkast och skickar en
 * tokenad länk via WhatsApp. Företagaren fyller i sina uppgifter, laddar upp
 * bilder och verifierar sitt WhatsApp-nummer med en kod som DU skickar
 * manuellt från din egen telefon (Cloud API kommer i PR-17).
 */

/** 14 dagar — en säljcykel på WhatsApp, inte mer. */
export const TOKEN_TTL_DAYS = 14;

/** OTP lever 10 minuter och tål fem försök. */
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export const INTAKE_STEPS = ["datos", "fotos", "verificacion"] as const;
export type IntakeStep = (typeof INTAKE_STEPS)[number];

export function isIntakeStep(v: string | undefined): v is IntakeStep {
  return typeof v === "string" && (INTAKE_STEPS as readonly string[]).includes(v);
}

/** 32 hex-tecken, matchar char(32) i schemat. */
export function newIntakeToken(): string {
  return randomBytes(16).toString("hex");
}

/** Sexsiffrig kod. randomInt är kryptografiskt säker; Math.random är det inte. */
export function newOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * sha256(kod + hemlighet). Saltet är SESSION_SECRET, så en läckt databas ger
 * inga användbara koder och en rotation av hemligheten ogiltigförklarar dem.
 */
export function hashOtp(code: string): string {
  return createHmac("sha256", env.sessionSecret).update(`otp:${code}`).digest("hex");
}

export function otpMatches(code: string, hash: string): boolean {
  const expected = hashOtp(code);
  if (expected.length !== hash.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
}

/** Konstanttidsjämförelse också för själva token — den är en hemlighet. */
export function tokenMatches(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Kort fingeravtryck av en token för loggning — aldrig hela token i loggen. */
export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 8);
}

// ---------- formulärscheman (kundvänd, spanska) ----------

const trimmed = (max: number) => z.string().trim().max(max);

/**
 * Kundens formulär är avsiktligt snävare än adminets: inga slugs, ingen SEO,
 * inget tema. Kunden fyller i data, aldrig layout (PLAN.md §1.3 D).
 */
export const intakeDataSchema = z.object({
  name: trimmed(120).min(2, "Escribí el nombre de tu negocio."),
  category: z.enum(["comercio", "servicios", "gastronomia", "salud", "belleza", "taller", "otro"]),
  rawDescription: trimmed(2000).min(
    40,
    "Contanos un poco más — al menos 40 caracteres. Después lo pulimos nosotros.",
  ),
  whatsappPhone: z
    .string()
    .trim()
    .min(1, "Necesitamos tu número de WhatsApp.")
    .transform((v, ctx) => {
      const normalized = normalizePyPhone(v);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Ese número no parece paraguayo. Ej: 0981 123 456" });
        return z.NEVER;
      }
      return normalized;
    }),
  secondaryPhone: trimmed(20).optional().or(z.literal("")),
  address: trimmed(200).optional().or(z.literal("")),
  zone: trimmed(80).optional().or(z.literal("")),
  city: trimmed(80).min(2, "¿En qué ciudad estás?"),
  instagram: trimmed(300).optional().or(z.literal("")),
  facebook: trimmed(300).optional().or(z.literal("")),
});

export type IntakeDataValues = z.infer<typeof intakeDataSchema>;

/** Upp till fem tjänster. Fler än så blir en lista ingen läser. */
export function servicesFromIntake(formData: FormData): { name: string; desc?: string }[] {
  const out: { name: string; desc?: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const name = String(formData.get(`service.${i}.name`) ?? "").trim();
    if (!name) continue;
    const desc = String(formData.get(`service.${i}.desc`) ?? "").trim();
    out.push(desc ? { name: name.slice(0, 120), desc: desc.slice(0, 300) } : { name: name.slice(0, 120) });
  }
  return out;
}

/**
 * Öppettider i intaken är avsiktligt grova: ett intervall per dag, eller
 * stängt. Delade pass (siesta) är vanliga i Paraguay men går att lägga till i
 * admin efteråt — ett stegformulär på mobil tål inte fyra tidsfält per dag.
 */
export function hoursFromIntake(formData: FormData): Record<string, { open: string; close: string }[] | null> {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const out: Record<string, { open: string; close: string }[] | null> = {};
  for (const day of days) {
    const closed = formData.get(`hours.${day}.closed`) === "on";
    const open = String(formData.get(`hours.${day}.open`) ?? "").trim();
    const close = String(formData.get(`hours.${day}.close`) ?? "").trim();
    out[day] = closed || !/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close) ? null : [{ open, close }];
  }
  return out;
}
