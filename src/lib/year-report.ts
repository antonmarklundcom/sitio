import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * "Tu año en cifras" (R3-23, den separerbara halvan av PR-20): en sida per
 * kund med årets siffror, som säljverktyg vid förnyelsen. Kunden öppnar den
 * från WhatsApp utan att logga in, så den skyddas som förhandsvisningen: en
 * HMAC av businessId, inget att lagra, ogiltig om SESSION_SECRET roteras.
 * Eget prefix — en preview-token öppnar inte rapporten och tvärtom.
 */
export function reportToken(businessId: number): string {
  return createHmac("sha256", env.sessionSecret).update(`year-report:${businessId}`).digest("hex").slice(0, 24);
}

export function verifyReportToken(businessId: number, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = reportToken(businessId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

/** Sökvägen till rapporten, med token. */
export function reportPath(businessId: number, slug: string): string {
  return `/reporte/${slug}?t=${reportToken(businessId)}`;
}

export type MonthPoint = { month: string; views: number; waClicks: number };

/** De tolv senaste månadsnycklarna ("YYYY-MM"), äldst först, innevarande sist. */
export function lastMonths(today: string, n = 12): string[] {
  const [y, m] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Fyller ut månader utan trafik med nollor, så att grafen alltid har tolv staplar. */
export function monthSeries(
  months: string[],
  rows: { month: string; views: number; waClicks: number }[],
): MonthPoint[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return months.map((month) => ({
    month,
    views: Number(byMonth.get(month)?.views ?? 0),
    waClicks: Number(byMonth.get(month)?.waClicks ?? 0),
  }));
}

/**
 * Årets bästa månad efter kontakter via WhatsApp, visningar som tiebreak —
 * en kontakt är det kunden betalar för, inte en visning. Null utan trafik.
 */
export function bestMonth(series: MonthPoint[]): MonthPoint | null {
  let best: MonthPoint | null = null;
  for (const p of series) {
    if (p.views === 0 && p.waClicks === 0) continue;
    if (!best || p.waClicks > best.waClicks || (p.waClicks === best.waClicks && p.views > best.views)) best = p;
  }
  return best;
}

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-03" → "marzo de 2026". */
export function monthLabelEs(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_ES[m - 1] ?? month} de ${y}`;
}

/** "2026-03" → "mar" (grafens axel). */
export function monthShortEs(month: string): string {
  return (MONTHS_ES[Number(month.split("-")[1]) - 1] ?? month).slice(0, 3);
}
