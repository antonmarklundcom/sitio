import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { activityLog, businesses } from "./schema";
import { env } from "@/lib/env";
import { daysUntil } from "@/lib/billing";
import { logActivity } from "@/lib/auth";
import { absoluteUrl } from "@/lib/env";
import { dayKeyAsuncion } from "@/lib/analytics";
import { hotLeadPayload, pushLead, venderCrmConfig } from "@/lib/vendercrm";
import { computeUpsellScore, isHotLead, type LeadStage, type UpsellStats } from "@/lib/radar";

// Samma korrelationsfälla som `src/db/queries.ts`: `${businesses.id}` i en
// select-lista renderas okvalificerat, och i en subfråga mot en tabell som
// också har en `id`-kolumn (media, subscriptions, business_modules) blir
// korrelationen då fel. Tabellnamnet skrivs därför ut explicit.
const bizId = sql`\`businesses\`.\`id\``;

/** `pushed`/`pushFailed` räknar VenderCRM-pushar (R3-22); båda 0 utan nyckel. */
/**
 * Misslyckades senaste pushen för sajten? Då görs ett nytt försök nästa natt
 * trots att sajten redan var hot — annars försvann en lead för att CRM:et
 * råkade vara nere en natt. Frågas bara för sajter som är hot.
 */
async function lastPushFailed(businessId: number): Promise<boolean> {
  const [last] = await db
    .select({ action: activityLog.action })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.businessId, businessId),
        inArray(activityLog.action, ["vendercrm_hot_lead_pushed", "vendercrm_hot_lead_failed"]),
      ),
    )
    .orderBy(desc(activityLog.id))
    .limit(1);
  return last?.action === "vendercrm_hot_lead_failed";
}

export type RadarResult = { updated: number; hotLeads: number; pushed: number; pushFailed: number };

/**
 * Räknar om `upsellScore`/`hotLead` för varje publicerad sajt i ett svep.
 * Trafiken kommer alltid ur `analytics_daily` (rollup-tabellen), aldrig ur
 * råeventen — samma regel som `listBusinesses`. En sajt som inte är
 * publicerad rörs inte: den behåller sin senaste poäng (plan §6.3).
 *
 * Körs nattligen från `/api/cron/rollup`, efter livscykelsteget.
 */
export async function runRadar(): Promise<RadarResult> {
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      category: businesses.category,
      whatsappPhone: businesses.whatsappPhone,
      wasHotLead: businesses.hotLead,
      waClicks30d: sql<number>`(
        select coalesce(sum(d.wa_clicks), 0) from analytics_daily d
        where d.business_id = ${bizId} and d.day >= curdate() - interval 30 day
      )`,
      views30d: sql<number>`(
        select coalesce(sum(d.views), 0) from analytics_daily d
        where d.business_id = ${bizId} and d.day >= curdate() - interval 30 day
      )`,
      galleryPhotos: sql<number>`(
        select count(*) from media m
        where m.business_id = ${bizId} and m.kind = 'photo'
      )`,
      menuOrProducts: sql<number>`(
        select count(*) from business_modules bm
        where bm.business_id = ${bizId} and bm.is_enabled = true
          and bm.module_key in ('menu', 'products')
      )`,
      subscriptionStatus: sql<string | null>`(
        select s.status from subscriptions s
        where s.business_id = ${bizId}
        order by s.expires_at desc limit 1
      )`,
      subscriptionExpiresAt: sql<string | null>`(
        select s.expires_at from subscriptions s
        where s.business_id = ${bizId}
        order by s.expires_at desc limit 1
      )`,
    })
    .from(businesses)
    .where(eq(businesses.status, "published"))
    .limit(1000);

  const thresholds = { waClicks30d: env.hotLeadWaClicks30d, views30d: env.hotLeadViews30d };
  const crm = venderCrmConfig();
  const dayKey = dayKeyAsuncion();
  let hotLeads = 0;
  let pushed = 0;
  let pushFailed = 0;

  for (const row of rows) {
    const stats: UpsellStats = {
      waClicks30d: Number(row.waClicks30d),
      views30d: Number(row.views30d),
      hasGalleryPhotos: Number(row.galleryPhotos) >= 8,
      hasMenuOrProducts: Number(row.menuOrProducts) > 0,
      subscriptionActiveLongRemaining:
        row.subscriptionStatus === "active" &&
        row.subscriptionExpiresAt != null &&
        daysUntil(row.subscriptionExpiresAt) > 200,
    };

    const upsellScore = computeUpsellScore(stats);
    const hotLead = isHotLead(stats, thresholds);
    if (hotLead) hotLeads += 1;

    await db.update(businesses).set({ upsellScore, hotLead }).where(eq(businesses.id, row.id));

    // VenderCRM (R3-22): bara när sajten BLIR hot, inte varje natt den är det
    // — annars får säljaren samma lead 30 gånger i månaden — plus ett nytt
    // försök efter en misslyckad push. Idempotency-nyckeln (sajt + dygn) tar
    // hand om en cron som körs två gånger.
    if (crm && hotLead && (!row.wasHotLead || (await lastPushFailed(row.id)))) {
      const result = await pushLead(
        crm,
        hotLeadPayload(
          {
            businessId: row.id,
            name: row.name,
            slug: row.slug,
            category: row.category,
            whatsappPhone: row.whatsappPhone,
            waClicks30d: stats.waClicks30d,
            views30d: stats.views30d,
            upsellScore,
            subscriptionStatus: row.subscriptionStatus,
            subscriptionExpiresAt: row.subscriptionExpiresAt ? String(row.subscriptionExpiresAt).slice(0, 10) : null,
          },
          absoluteUrl(`/${row.slug}`),
          dayKey,
        ),
      );
      if (result.ok) pushed += 1;
      else pushFailed += 1;
      await logActivity({
        businessId: row.id,
        action: result.ok ? "vendercrm_hot_lead_pushed" : "vendercrm_hot_lead_failed",
        meta: { status: result.status, duplicate: result.duplicate ?? false, error: result.error ?? null },
      });
      if (!result.ok) console.error(`[vendercrm] push för business ${row.id} misslyckades:`, result.status, result.error);
    }
  }

  await logActivity({
    action: "radar_run",
    meta: { businesses: rows.length, hotLeads, pushed, pushFailed },
  });

  return { updated: rows.length, hotLeads, pushed, pushFailed };
}

export type LeadRow = {
  id: number;
  slug: string;
  name: string;
  whatsappPhone: string;
  upsellScore: number;
  hotLead: boolean;
  leadStage: LeadStage;
  adminNotes: string | null;
  views30d: number;
  waClicks30d: number;
};

/** `/admin/leads`: alla sajter, poäng-sorterade — inte bara publicerade. */
export async function listLeads(): Promise<LeadRow[]> {
  const rows = await db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      whatsappPhone: businesses.whatsappPhone,
      upsellScore: businesses.upsellScore,
      hotLead: businesses.hotLead,
      leadStage: businesses.leadStage,
      adminNotes: businesses.adminNotes,
      views30d: sql<number>`(
        select coalesce(sum(d.views), 0) from analytics_daily d
        where d.business_id = ${bizId} and d.day >= curdate() - interval 30 day
      )`,
      waClicks30d: sql<number>`(
        select coalesce(sum(d.wa_clicks), 0) from analytics_daily d
        where d.business_id = ${bizId} and d.day >= curdate() - interval 30 day
      )`,
    })
    .from(businesses)
    .orderBy(desc(businesses.upsellScore))
    .limit(300);

  return rows.map((r) => ({
    ...r,
    views30d: Number(r.views30d),
    waClicks30d: Number(r.waClicks30d),
  })) as LeadRow[];
}
