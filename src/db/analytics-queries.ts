import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./index";
import { analyticsDaily } from "./schema";
import { dayKeyAsuncion } from "@/lib/analytics";
import { ensureRollupFresh } from "@/lib/rollup";

export type DailyPoint = {
  day: string;
  views: number;
  uniques: number;
  waClicks: number;
};

export type AnalyticsSummary = {
  views: number;
  uniques: number;
  waClicks: number;
  phoneClicks: number;
  mapClicks: number;
  socialClicks: number;
};

export type BusinessAnalytics = {
  series30: DailyPoint[];
  last30: AnalyticsSummary;
  last365: AnalyticsSummary;
};

const EMPTY: AnalyticsSummary = {
  views: 0,
  uniques: 0,
  waClicks: 0,
  phoneClicks: 0,
  mapClicks: 0,
  socialClicks: 0,
};

function dayString(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

/** Dagsnycklar bakåt från idag (Asunción), äldst först. */
function lastDays(n: number): string[] {
  const today = new Date(`${dayKeyAsuncion()}T00:00:00Z`);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function summarize(businessId: number, days: number): Promise<AnalyticsSummary> {
  const from = new Date(`${lastDays(days)[0]}T00:00:00Z`);
  const [row] = await db
    .select({
      views: sql<number>`coalesce(sum(${analyticsDaily.views}), 0)`,
      // uniques summeras per dygn — samma besökare två dagar räknas två gånger.
      // Det är "unika per dag", inte "unika i perioden", och etiketten i
      // adminet säger just det.
      uniques: sql<number>`coalesce(sum(${analyticsDaily.uniques}), 0)`,
      waClicks: sql<number>`coalesce(sum(${analyticsDaily.waClicks}), 0)`,
      phoneClicks: sql<number>`coalesce(sum(${analyticsDaily.phoneClicks}), 0)`,
      mapClicks: sql<number>`coalesce(sum(${analyticsDaily.mapClicks}), 0)`,
      socialClicks: sql<number>`coalesce(sum(${analyticsDaily.socialClicks}), 0)`,
    })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.businessId, businessId), gte(analyticsDaily.day, from)));

  if (!row) return EMPTY;
  return {
    views: Number(row.views),
    uniques: Number(row.uniques),
    waClicks: Number(row.waClicks),
    phoneClicks: Number(row.phoneClicks),
    mapClicks: Number(row.mapClicks),
    socialClicks: Number(row.socialClicks),
  };
}

/**
 * Statistik för en sajt. Kör lazy-rollupen först så att dagens siffror finns
 * även när hPanel-cron inte är uppsatt — annars hade grafen sett död ut i
 * exakt det läge där man mest behöver den.
 */
export async function getBusinessAnalytics(businessId: number): Promise<BusinessAnalytics> {
  await ensureRollupFresh();

  const days = lastDays(30);
  const rows = await db
    .select()
    .from(analyticsDaily)
    .where(
      and(eq(analyticsDaily.businessId, businessId), gte(analyticsDaily.day, new Date(`${days[0]}T00:00:00Z`))),
    );

  const byDay = new Map(rows.map((r) => [dayString(r.day), r]));
  const series30: DailyPoint[] = days.map((day) => {
    const row = byDay.get(day);
    return {
      day,
      views: row ? Number(row.views) : 0,
      uniques: row ? Number(row.uniques) : 0,
      waClicks: row ? Number(row.waClicks) : 0,
    };
  });

  const [last30, last365] = await Promise.all([summarize(businessId, 30), summarize(businessId, 365)]);
  return { series30, last30, last365 };
}
