import "server-only";
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "./index";
import { analyticsDaily, analyticsEvents, siteLeads } from "./schema";
import { dayKeyAsuncion, windowStartAsuncion } from "@/lib/analytics";
import { classifyLeadSource, LEAD_SOURCES, type LeadSource } from "@/lib/lead-source";
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

export type CtaCount = {
  type: "whatsapp_click" | "phone_click" | "map_click" | "social_click";
  /** `data-ev-loc`, eller null för klick från före R3-18. */
  loc: string | null;
  clicks: number;
};

/**
 * Klick per CTA de senaste 30 dygnen (R3-18). Läser råeventen, inte rollupen:
 * `analytics_daily` har en kolumn per typ, inte per knapp, och råeventen
 * sparas 396 dygn. Bots räknas inte, samma regel som rollupen.
 */
export async function getCtaBreakdown(businessId: number): Promise<CtaCount[]> {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      type: analyticsEvents.type,
      loc: analyticsEvents.ctaLoc,
      clicks: sql<number>`count(*)`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.businessId, businessId),
        inArray(analyticsEvents.type, ["whatsapp_click", "phone_click", "map_click", "social_click"]),
        ne(analyticsEvents.deviceType, "bot"),
        gte(analyticsEvents.createdAt, from),
      ),
    )
    .groupBy(analyticsEvents.type, analyticsEvents.ctaLoc)
    .orderBy(desc(sql`count(*)`));

  return rows.map((r) => ({ type: r.type as CtaCount["type"], loc: r.loc, clicks: Number(r.clicks) }));
}

export type SourceRow = {
  source: LeadSource;
  views: number;
  waClicks: number;
  leads: number;
};

type EventGroup = { host: string | null; type: string; n: number };
type LeadGroup = { source: string | null; n: number };

/**
 * Ren aggregering (testbar utan databas): klassar varje referrer_host till en
 * källa och summerar. Leads utan källa (äldre än crm-1) räknas som "directo".
 * Sorterad på visningar, sedan klick, sedan konsultationer; tomma källor utelämnas.
 */
export function buildSourceBreakdown(events: EventGroup[], leads: LeadGroup[]): SourceRow[] {
  const map = new Map<LeadSource, SourceRow>();
  const row = (source: LeadSource) => {
    let r = map.get(source);
    if (!r) map.set(source, (r = { source, views: 0, waClicks: 0, leads: 0 }));
    return r;
  };
  for (const e of events) {
    const r = row(classifyLeadSource(e.host));
    if (e.type === "page_view") r.views += e.n;
    else if (e.type === "whatsapp_click") r.waClicks += e.n;
  }
  for (const l of leads) {
    const src = classifyLeadSource(l.source);
    // site_leads.source är redan en LeadSource; klassningen normaliserar bara okända värden.
    row(l.source && (LEAD_SOURCES as readonly string[]).includes(l.source) ? (l.source as LeadSource) : src).leads += l.n;
  }
  return [...map.values()].sort((a, b) => b.views - a.views || b.waClicks - a.waClicks || b.leads - a.leads);
}

/**
 * Fuentes (crm-1): besök, WhatsApp-klick och konsultationer per källa de
 * senaste `days` dygnen. Fönstret följer R3-41 (windowStartAsuncion, idag +
 * dygnen före). Händelserna grupperas i SQL på referrer_host + type (täcks av
 * i_biz_type_created) och klassas i JS. Bots räknas inte.
 */
export async function getSourceBreakdown(businessId: number, days = 30): Promise<SourceRow[]> {
  const from = new Date(`${windowStartAsuncion(days)}T00:00:00Z`);
  const [events, leads] = await Promise.all([
    db
      .select({
        host: analyticsEvents.referrerHost,
        type: analyticsEvents.type,
        n: sql<number>`count(*)`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.businessId, businessId),
          inArray(analyticsEvents.type, ["page_view", "whatsapp_click"]),
          ne(analyticsEvents.deviceType, "bot"),
          gte(analyticsEvents.createdAt, from),
        ),
      )
      .groupBy(analyticsEvents.referrerHost, analyticsEvents.type),
    db
      .select({ source: siteLeads.source, n: sql<number>`count(*)` })
      .from(siteLeads)
      .where(and(eq(siteLeads.businessId, businessId), gte(siteLeads.createdAt, from)))
      .groupBy(siteLeads.source),
  ]);

  return buildSourceBreakdown(
    events.map((e) => ({ host: e.host, type: e.type, n: Number(e.n) })),
    leads.map((l) => ({ source: l.source, n: Number(l.n) })),
  );
}
