import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "./index";
import { analyticsDaily, analyticsEvents } from "./schema";
import { dayKeyAsuncion } from "@/lib/analytics";
import { addDays, toDayString } from "@/lib/billing";
import { lastMonths, monthSeries, type MonthPoint } from "@/lib/year-report";
import { ensureRollupFresh } from "@/lib/rollup";

export type YearReport = {
  from: string;
  to: string;
  views: number;
  waClicks: number;
  phoneClicks: number;
  mapClicks: number;
  socialClicks: number;
  months: MonthPoint[];
  /** menu_view / products_view / gallery_view ur råeventen (ingen rollup-kolumn). */
  sectionViews: { menu: number; products: number; gallery: number };
  /** Den knapp som gav flest WhatsApp-klick (`cta_loc`, R3-18), eller null. */
  topCta: { loc: string; clicks: number } | null;
};

/**
 * Årets siffror för en sajt (R3-23). Summorna och månaderna ur rollupen,
 * sektionsvyerna och knappen ur råeventen — de sparas 396 dygn, så ett helt
 * år finns alltid. Bots räknas inte, samma regel som överallt.
 */
export async function getYearReport(businessId: number): Promise<YearReport> {
  await ensureRollupFresh();

  const to = dayKeyAsuncion();
  const from = toDayString(addDays(to, -364));
  const fromDate = new Date(`${from}T00:00:00Z`);
  const months = lastMonths(to);

  const [[totals], monthRows, sectionRows, [top]] = await Promise.all([
    db
      .select({
        views: sql<number>`coalesce(sum(${analyticsDaily.views}), 0)`,
        waClicks: sql<number>`coalesce(sum(${analyticsDaily.waClicks}), 0)`,
        phoneClicks: sql<number>`coalesce(sum(${analyticsDaily.phoneClicks}), 0)`,
        mapClicks: sql<number>`coalesce(sum(${analyticsDaily.mapClicks}), 0)`,
        socialClicks: sql<number>`coalesce(sum(${analyticsDaily.socialClicks}), 0)`,
      })
      .from(analyticsDaily)
      .where(and(eq(analyticsDaily.businessId, businessId), gte(analyticsDaily.day, fromDate))),
    db
      .select({
        month: sql<string>`date_format(${analyticsDaily.day}, '%Y-%m')`,
        views: sql<number>`coalesce(sum(${analyticsDaily.views}), 0)`,
        waClicks: sql<number>`coalesce(sum(${analyticsDaily.waClicks}), 0)`,
      })
      .from(analyticsDaily)
      .where(
        and(
          eq(analyticsDaily.businessId, businessId),
          gte(analyticsDaily.day, new Date(`${months[0]}-01T00:00:00Z`)),
        ),
      )
      .groupBy(sql`date_format(${analyticsDaily.day}, '%Y-%m')`),
    db
      .select({ type: analyticsEvents.type, n: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.businessId, businessId),
          inArray(analyticsEvents.type, ["menu_view", "products_view", "gallery_view"]),
          ne(analyticsEvents.deviceType, "bot"),
          gte(analyticsEvents.createdAt, fromDate),
        ),
      )
      .groupBy(analyticsEvents.type),
    db
      .select({ loc: analyticsEvents.ctaLoc, clicks: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.businessId, businessId),
          eq(analyticsEvents.type, "whatsapp_click"),
          isNotNull(analyticsEvents.ctaLoc),
          ne(analyticsEvents.deviceType, "bot"),
          gte(analyticsEvents.createdAt, fromDate),
        ),
      )
      .groupBy(analyticsEvents.ctaLoc)
      .orderBy(desc(sql`count(*)`))
      .limit(1),
  ]);

  const section = (type: string) => Number(sectionRows.find((r) => r.type === type)?.n ?? 0);
  return {
    from,
    to,
    views: Number(totals?.views ?? 0),
    waClicks: Number(totals?.waClicks ?? 0),
    phoneClicks: Number(totals?.phoneClicks ?? 0),
    mapClicks: Number(totals?.mapClicks ?? 0),
    socialClicks: Number(totals?.socialClicks ?? 0),
    months: monthSeries(
      months,
      monthRows.map((r) => ({ month: r.month, views: Number(r.views), waClicks: Number(r.waClicks) })),
    ),
    sectionViews: { menu: section("menu_view"), products: section("products_view"), gallery: section("gallery_view") },
    topCta: top?.loc ? { loc: top.loc, clicks: Number(top.clicks) } : null,
  };
}
