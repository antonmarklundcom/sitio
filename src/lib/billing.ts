import { z } from "zod";
import { formatGs } from "./format";

/**
 * Prenumerationer och betalningar, manuellt bekräftade (PLAN.md §1.7).
 * Ingen Stripe: kunden betalar via transferencia/giros/Tigo Money/Billetera
 * Personal/efectivo och skickar comprobante på WhatsApp. Systemet räknar
 * datumen, du bekräftar.
 *
 * Pengar är alltid heltals-guaraníes. Ingen decimal, ingen float, aldrig.
 */

export const PLANS = ["basico", "plus", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LABELS: Record<Plan, string> = {
  basico: "Básico",
  plus: "Plus",
  pro: "Pro",
};

/** Riktpriser per år. Det faktiska priset sätts per kund — du förhandlar. */
export const PLAN_SUGGESTED_PRICE_GS: Record<Plan, number> = {
  basico: 300_000,
  plus: 450_000,
  pro: 600_000,
};

export const PAYMENT_METHODS = [
  "transferencia",
  "giros",
  "efectivo",
  "tigo_money",
  "billetera_personal",
  "zimple",
  "tarjeta",
  "otro",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transferencia: "Transferencia",
  giros: "Giros Tigo/Personal",
  efectivo: "Efectivo",
  tigo_money: "Tigo Money",
  billetera_personal: "Billetera Personal",
  zimple: "Zimple",
  tarjeta: "Tarjeta",
  otro: "Annat",
};

export const SUBSCRIPTION_STATUSES = ["trial", "active", "grace", "expired", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  active: "Betald",
  grace: "Respit",
  expired: "Förfallen",
  canceled: "Avslutad",
};

/** Dagar efter förfall då sajten står kvar uppe (PLAN.md §1.7). */
export const GRACE_DAYS = 15;

/** Tröskel för "Vencen pronto"-vyn. */
export const EXPIRING_SOON_DAYS = 45;

// ---------- datum ----------

/** Datum som "YYYY-MM-DD". Drizzles date-kolumner tar Date, listorna sträng. */
export function toDayString(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export function parseDay(value: Date | string): Date {
  return new Date(`${toDayString(value)}T00:00:00Z`);
}

export function addDays(value: Date | string, days: number): Date {
  const d = parseDay(value);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Ett år fram. Skottdagen hanteras av Date: 29 feb + 1 år blir 1 mars, vilket
 * är fel dag men rätt beteende — kunden ska aldrig få en kortare period än ett
 * år för att hen råkade betala på ett skottår.
 */
export function addYear(value: Date | string): Date {
  const d = parseDay(value);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

export function daysUntil(expiresAt: Date | string, today: Date | string = new Date()): number {
  const ms = parseDay(expiresAt).getTime() - parseDay(today).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Livscykeln: active → (förfallodatum) grace (15 dgr, sajten uppe) → expired.
 *
 * `canceled` är ett manuellt beslut och räknas aldrig om automatiskt — den som
 * har sagt upp ska inte tyst återuppstå som "expired" och trigga en paus av en
 * sajt som redan är avslutad. `trial` följer samma datumlogik som `active`.
 */
export function lifecycleStatus(
  current: SubscriptionStatus,
  expiresAt: Date | string,
  today: Date | string = new Date(),
): SubscriptionStatus {
  if (current === "canceled") return "canceled";

  const left = daysUntil(expiresAt, today);
  if (left >= 0) return current === "trial" ? "trial" : "active";
  if (left >= -GRACE_DAYS) return "grace";
  return "expired";
}

// ---------- förnyelsemeddelande ----------

/**
 * wa.me-texten vid förnyelse. Statistiken ÄR säljargumentet (PLAN.md §1.7) —
 * därför skickas den in, aldrig gissad, och utelämnas hellre än avrundas till
 * något som låter bra.
 *
 * Voseo, som all kund-UI.
 */
export function renewalMessage(params: {
  businessName: string;
  priceGs: number;
  views365: number;
  waClicks365: number;
  siteUrl: string;
}): string {
  const { businessName, priceGs, views365, waClicks365, siteUrl } = params;
  const nf = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });

  const stats =
    views365 > 0 || waClicks365 > 0
      ? `Tu página tuvo ${nf.format(views365)} visitas y ${nf.format(waClicks365)} contactos por WhatsApp este año 📈. `
      : "";

  return (
    `Hola ${businessName}! Te escribo de sitio.com.py. ` +
    stats +
    `Tu página (${siteUrl}) vence pronto. ¿La renovamos por ${formatGs(priceGs)} el año?`
  );
}

// ---------- formulärscheman ----------

const gsAmount = z.coerce
  .number({ message: "Ange ett belopp i guaraníes." })
  .int("Guaraníes har inga decimaler.")
  .min(0, "Beloppet kan inte vara negativt.")
  .max(1_000_000_000, "Beloppet ser fel ut.");

const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum måste vara YYYY-MM-DD.");

export const subscriptionFormSchema = z.object({
  plan: z.enum(PLANS),
  priceGs: gsAmount,
  startsAt: dayString,
  expiresAt: dayString,
  status: z.enum(SUBSCRIPTION_STATUSES),
});

export const paymentFormSchema = z.object({
  amountGs: gsAmount,
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  periodStart: dayString,
  periodEnd: dayString,
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export type SubscriptionFormValues = z.infer<typeof subscriptionFormSchema>;
export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
