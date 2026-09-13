import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { businesses } from "./schema";
import { env } from "@/lib/env";
import { daysUntil } from "@/lib/billing";
import { logActivity } from "@/lib/auth";
import { computeUpsellScore, isHotLead, type LeadStage, type UpsellStats } from "@/lib/radar";

// Samma korrelationsfälla som `src/db/queries.ts`: `${businesses.id}` i en
// select-lista renderas okvalificerat, och i en subfråga mot en tabell som
// också har en `id`-kolumn (media, subscriptions, business_modules) blir
// korrelationen då fel. Tabellnamnet skrivs därför ut explicit.
const bizId = sql`\`businesses\`.\`id\``;

export type RadarResult = { updated: number; hotLeads: number };

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
  let hotLeads = 0;

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
  }

  await logActivity({
    action: "radar_run",
    meta: { businesses: rows.length, hotLeads },
  });

  return { updated: rows.length, hotLeads };
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
