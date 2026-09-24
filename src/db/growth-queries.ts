import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "./index";
import {
  analyticsDaily,
  businesses,
  outboundMessages,
  partnerCommissions,
  partners,
  payments,
  serviceRequests,
  siteLeads,
  subscriptions,
} from "./schema";
import { readSetting, upsertSetting } from "./settings-queries";
import { logActivity } from "@/lib/auth";
import { addDays, daysUntil, toDayString, todayAsuncion } from "@/lib/billing";
import {
  commissionGs,
  growthSettingsSchema,
  newReferralCode,
  parseGrowthSettings,
  parseUpsellCatalog,
  previousMonth,
  renewalPeriodKey,
  renewalStage,
  upsellCatalogSchema,
  type GrowthSettings,
  type RenewalStage,
  type UpsellService,
} from "@/lib/growth";

// ---------- inställningar ----------

export async function getGrowthSettings(): Promise<GrowthSettings> {
  try {
    return parseGrowthSettings(await readSetting("growth"));
  } catch {
    return parseGrowthSettings(null);
  }
}

export async function saveGrowthSettings(value: GrowthSettings): Promise<void> {
  await upsertSetting("growth", JSON.stringify(growthSettingsSchema.parse(value)));
}

export async function getUpsellCatalog(): Promise<UpsellService[]> {
  try {
    return parseUpsellCatalog(await readSetting("upsells"));
  } catch {
    return parseUpsellCatalog(null);
  }
}

export async function saveUpsellCatalog(value: UpsellService[]): Promise<void> {
  await upsertSetting("upsells", JSON.stringify(upsellCatalogSchema.parse(value)));
}

// ---------- värvningskoder ----------

/**
 * Kundens värvningskod, skapad första gången den behövs. Unik över både
 * kunder och säljare: en kod pekar alltid på exakt en.
 */
export async function ensureReferralCode(businessId: number): Promise<string> {
  const [row] = await db
    .select({ code: businesses.referralCode })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (row?.code) return row.code;

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newReferralCode();
    if (await codeTaken(code)) continue;
    try {
      const [res] = await db
        .update(businesses)
        .set({ referralCode: code })
        .where(and(eq(businesses.id, businessId), isNull(businesses.referralCode)));
      if (res.affectedRows) return code;
      // Någon annan hann före — läs det som sparades.
      const [again] = await db.select({ code: businesses.referralCode }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (again?.code) return again.code;
    } catch {
      // Unik-krock mot en samtidig kund: försök med en ny kod.
    }
  }
  throw new Error("No se pudo generar un código de referido.");
}

async function codeTaken(code: string): Promise<boolean> {
  const [[biz], [partner]] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.referralCode, code)).limit(1),
    db.select({ id: partners.id }).from(partners).where(eq(partners.code, code)).limit(1),
  ]);
  return Boolean(biz || partner);
}

export type RefTarget = { partnerId: number; businessId?: undefined } | { businessId: number; partnerId?: undefined };

/** ?ref=<kod> ⇒ säljare (aktiv) eller kund. Okänd kod ⇒ null, tyst. */
export async function resolveRefCode(code: string | null): Promise<RefTarget | null> {
  if (!code) return null;
  const [partner] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.code, code), eq(partners.status, "active")))
    .limit(1);
  if (partner) return { partnerId: partner.id };
  const [biz] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.referralCode, code)).limit(1);
  return biz ? { businessId: biz.id } : null;
}

export type ReferralStats = { signedUp: number; paid: number };

export async function getReferralStats(businessId: number): Promise<ReferralStats> {
  const rows = await db
    .select({ rewardedAt: businesses.referralRewardedAt })
    .from(businesses)
    .where(eq(businesses.referredByBusinessId, businessId));
  return { signedUp: rows.length, paid: rows.filter((r) => r.rewardedAt).length };
}

// ---------- betalning bekräftad ⇒ värvningsbonus och provision ----------

async function extendSubscription(businessId: number, days: number): Promise<string | null> {
  if (days <= 0) return null;
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .orderBy(desc(subscriptions.expiresAt), desc(subscriptions.id))
    .limit(1);
  if (!sub || sub.status === "canceled") return null;
  const next = addDays(sub.expiresAt, days);
  await db.update(subscriptions).set({ expiresAt: next }).where(eq(subscriptions.id, sub.id));
  return toDayString(next);
}

/**
 * Körs efter att en betalning bekräftats. Två saker, båda idempotenta:
 *
 * 1. Kund värvad av kund: första bekräftade betalningen ger båda extra dagar.
 *    `referral_rewarded_at` sätts med ett villkorat UPDATE innan dagarna ges,
 *    så en dubbelklickad bekräftelse aldrig ger bonus två gånger.
 * 2. Kund värvad av säljare: provision på varje bekräftad betalning inom ett
 *    år från den första provisionen för kunden. `payment_id` är unik.
 *
 * Kastar aldrig: bekräftelsen är redan gjord, och en bonus som uteblir går
 * att rätta för hand — en krasch i bekräftelseflödet gör det inte.
 */
export async function applyGrowthOnPaymentConfirmed(paymentId: number, actorUserId: number | null): Promise<void> {
  try {
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment || payment.status !== "confirmed") return;
    const [business] = await db.select().from(businesses).where(eq(businesses.id, payment.businessId)).limit(1);
    if (!business) return;
    const settings = await getGrowthSettings();

    if (business.referredByBusinessId && !business.referralRewardedAt) {
      const [claim] = await db
        .update(businesses)
        .set({ referralRewardedAt: new Date() })
        .where(and(eq(businesses.id, business.id), isNull(businesses.referralRewardedAt)));
      if (claim.affectedRows) {
        const referrerUntil = await extendSubscription(business.referredByBusinessId, settings.referralRewardDays);
        const referredUntil = await extendSubscription(business.id, settings.referredBonusDays);
        await logActivity({
          actorUserId,
          businessId: business.referredByBusinessId,
          action: "referido_premio",
          meta: { referredBusinessId: business.id, days: settings.referralRewardDays, expiresAt: referrerUntil },
        });
        await logActivity({
          actorUserId,
          businessId: business.id,
          action: "referido_bonus",
          meta: { referrerBusinessId: business.referredByBusinessId, days: settings.referredBonusDays, expiresAt: referredUntil },
        });
      }
    }

    if (business.partnerId) {
      const [partner] = await db.select().from(partners).where(eq(partners.id, business.partnerId)).limit(1);
      if (!partner) return;
      const [first] = await db
        .select({ createdAt: partnerCommissions.createdAt })
        .from(partnerCommissions)
        .where(and(eq(partnerCommissions.partnerId, partner.id), eq(partnerCommissions.businessId, business.id)))
        .orderBy(asc(partnerCommissions.createdAt))
        .limit(1);
      const withinFirstYear = !first || Date.now() - new Date(first.createdAt).getTime() < 365 * 86_400_000;
      if (!withinFirstYear) return;
      const amountGs = commissionGs(Number(payment.amountGs), partner.commissionPct);
      if (amountGs <= 0) return;
      const [res] = await db
        .insert(partnerCommissions)
        .values({ partnerId: partner.id, businessId: business.id, paymentId: payment.id, amountGs })
        .onDuplicateKeyUpdate({ set: { paymentId: sql`payment_id` } });
      if (res.affectedRows === 1) {
        await logActivity({
          actorUserId,
          businessId: business.id,
          action: "comision_generada",
          meta: { partnerId: partner.id, paymentId: payment.id, amountGs, pct: partner.commissionPct },
        });
      }
    }
  } catch (error) {
    console.error("[growth] applyGrowthOnPaymentConfirmed", paymentId, error);
  }
}

// ---------- consultas (site_leads) ----------

export async function listSiteLeads(businessId: number, limit = 50) {
  return db
    .select()
    .from(siteLeads)
    .where(eq(siteLeads.businessId, businessId))
    .orderBy(desc(siteLeads.createdAt), desc(siteLeads.id))
    .limit(limit);
}

export async function countNewSiteLeads(businessId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(siteLeads)
    .where(and(eq(siteLeads.businessId, businessId), eq(siteLeads.status, "nuevo")));
  return Number(row?.n ?? 0);
}

// ---------- tjänsteförfrågningar ----------

export async function listServiceRequests(limit = 200) {
  return db
    .select({
      id: serviceRequests.id,
      businessId: serviceRequests.businessId,
      businessName: businesses.name,
      slug: businesses.slug,
      whatsappPhone: businesses.whatsappPhone,
      serviceKey: serviceRequests.serviceKey,
      serviceTitle: serviceRequests.serviceTitle,
      status: serviceRequests.status,
      createdAt: serviceRequests.createdAt,
    })
    .from(serviceRequests)
    .innerJoin(businesses, eq(businesses.id, serviceRequests.businessId))
    .orderBy(asc(sql`field(${serviceRequests.status}, 'nuevo', 'contactado', 'vendido', 'descartado')`), desc(serviceRequests.createdAt))
    .limit(limit);
}

export async function openServiceRequestKeys(businessId: number): Promise<Set<string>> {
  const rows = await db
    .select({ key: serviceRequests.serviceKey })
    .from(serviceRequests)
    .where(and(eq(serviceRequests.businessId, businessId), inArray(serviceRequests.status, ["nuevo", "contactado"])));
  return new Set(rows.map((r) => r.key));
}

// ---------- säljare ----------

export function newPartnerToken(): string {
  return randomBytes(16).toString("hex");
}

export async function newPartnerCode(name: string): Promise<string> {
  const prefix = name
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 3);
  for (let i = 0; i < 8; i++) {
    const code = newReferralCode(prefix.length === 3 ? prefix : "VEN", Math.random, 4);
    if (!(await codeTaken(code))) return code;
  }
  throw new Error("No se pudo generar un código.");
}

export type PartnerSummary = {
  id: number;
  name: string;
  phone: string | null;
  code: string;
  commissionPct: number;
  token: string;
  status: "active" | "disabled";
  notes: string | null;
  businesses: number;
  pendingGs: number;
  paidGs: number;
};

export async function listPartners(): Promise<PartnerSummary[]> {
  const rows = await db.select().from(partners).orderBy(asc(partners.name));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [bizCounts, sums] = await Promise.all([
    db
      .select({ partnerId: businesses.partnerId, n: count() })
      .from(businesses)
      .where(inArray(businesses.partnerId, ids))
      .groupBy(businesses.partnerId),
    db
      .select({
        partnerId: partnerCommissions.partnerId,
        status: partnerCommissions.status,
        total: sql<number>`coalesce(sum(${partnerCommissions.amountGs}), 0)`,
      })
      .from(partnerCommissions)
      .where(inArray(partnerCommissions.partnerId, ids))
      .groupBy(partnerCommissions.partnerId, partnerCommissions.status),
  ]);
  return rows.map((p) => ({
    ...p,
    businesses: Number(bizCounts.find((b) => b.partnerId === p.id)?.n ?? 0),
    pendingGs: Number(sums.find((s) => s.partnerId === p.id && s.status === "pending")?.total ?? 0),
    paidGs: Number(sums.find((s) => s.partnerId === p.id && s.status === "paid")?.total ?? 0),
  }));
}

export async function listCommissions(filter: { partnerId?: number; status?: "pending" | "paid" | "void" } = {}) {
  const where = [
    filter.partnerId ? eq(partnerCommissions.partnerId, filter.partnerId) : undefined,
    filter.status ? eq(partnerCommissions.status, filter.status) : undefined,
  ].filter(Boolean);
  return db
    .select({
      id: partnerCommissions.id,
      partnerId: partnerCommissions.partnerId,
      partnerName: partners.name,
      businessId: partnerCommissions.businessId,
      businessName: businesses.name,
      amountGs: partnerCommissions.amountGs,
      status: partnerCommissions.status,
      paidAt: partnerCommissions.paidAt,
      createdAt: partnerCommissions.createdAt,
    })
    .from(partnerCommissions)
    .innerJoin(partners, eq(partners.id, partnerCommissions.partnerId))
    .innerJoin(businesses, eq(businesses.id, partnerCommissions.businessId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(partnerCommissions.createdAt))
    .limit(300);
}

/** Säljarens egen rapportsida — bara via token, aldrig via id. */
export async function getPartnerReport(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const [partner] = await db.select().from(partners).where(eq(partners.token, token)).limit(1);
  if (!partner || partner.status !== "active") return null;
  const [clients, commissions] = await Promise.all([
    db
      .select({ id: businesses.id, name: businesses.name, status: businesses.status, createdAt: businesses.createdAt })
      .from(businesses)
      .where(eq(businesses.partnerId, partner.id))
      .orderBy(desc(businesses.createdAt))
      .limit(300),
    listCommissions({ partnerId: partner.id }),
  ]);
  return { partner, clients, commissions };
}

// ---------- meddelandekön ----------

export type QueueItem = {
  businessId: number;
  businessName: string;
  slug: string;
  whatsappPhone: string;
  kind: "monthly_stats" | RenewalStage;
  periodKey: string;
  /** Förnyelse: dagar kvar, pris, plan och år-siffror. Månad: månadens siffror. */
  daysLeft?: number;
  priceGs?: number;
  expiresAt?: string;
  views: number;
  waClicks: number;
  leads?: number;
  monthLabel?: string;
};

/**
 * Allt som borde skickas idag och inte har skickats: förnyelsepåminnelser
 * (30/15/7 dagar och förfallna) och förra månadens siffror till varje
 * publicerad sajt med trafik. Skickat = en rad i outbound_messages.
 */
export async function listMessageQueue(today: string = todayAsuncion()): Promise<QueueItem[]> {
  const cutoff = new Date(`${toDayString(addDays(today, 30))}T00:00:00Z`);
  const subs = await db
    .select({
      subscriptionId: subscriptions.id,
      businessId: businesses.id,
      businessName: businesses.name,
      slug: businesses.slug,
      whatsappPhone: businesses.whatsappPhone,
      priceGs: subscriptions.priceGs,
      status: subscriptions.status,
      expiresAt: subscriptions.expiresAt,
    })
    .from(subscriptions)
    .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
    .where(
      and(
        inArray(subscriptions.status, ["trial", "active", "grace", "expired"]),
        inArray(businesses.status, ["published", "paused"]),
        lte(subscriptions.expiresAt, cutoff),
      ),
    )
    .orderBy(asc(subscriptions.expiresAt))
    .limit(300);

  // Bara den senaste prenumerationen per sajt räknas.
  const latest = new Map<number, (typeof subs)[number]>();
  for (const s of subs) {
    const prev = latest.get(s.businessId);
    if (!prev || toDayString(s.expiresAt) > toDayString(prev.expiresAt)) latest.set(s.businessId, s);
  }

  const renewals: QueueItem[] = [];
  for (const s of latest.values()) {
    const left = daysUntil(s.expiresAt, today);
    // Förfallna för länge sedan (> 30 dagar) jagas inte längre av kön.
    if (left < -30) continue;
    const stage = renewalStage(left);
    if (!stage) continue;
    renewals.push({
      businessId: s.businessId,
      businessName: s.businessName,
      slug: s.slug,
      whatsappPhone: s.whatsappPhone,
      kind: stage,
      periodKey: `${renewalPeriodKey(s.subscriptionId, toDayString(s.expiresAt))}:${stage}`,
      daysLeft: left,
      priceGs: Number(s.priceGs),
      expiresAt: toDayString(s.expiresAt),
      views: 0,
      waClicks: 0,
    });
  }

  // Årssiffror till förnyelserna — säljargumentet.
  if (renewals.length > 0) {
    const since = new Date(`${toDayString(addDays(today, -365))}T00:00:00Z`);
    const stats = await db
      .select({
        businessId: analyticsDaily.businessId,
        views: sql<number>`coalesce(sum(${analyticsDaily.views}), 0)`,
        waClicks: sql<number>`coalesce(sum(${analyticsDaily.waClicks}), 0)`,
      })
      .from(analyticsDaily)
      .where(and(inArray(analyticsDaily.businessId, renewals.map((r) => r.businessId)), gte(analyticsDaily.day, since)))
      .groupBy(analyticsDaily.businessId);
    for (const r of renewals) {
      const st = stats.find((x) => x.businessId === r.businessId);
      r.views = Number(st?.views ?? 0);
      r.waClicks = Number(st?.waClicks ?? 0);
    }
  }

  // Förra månadens siffror.
  const month = previousMonth(today);
  const monthly = await db
    .select({
      businessId: businesses.id,
      businessName: businesses.name,
      slug: businesses.slug,
      whatsappPhone: businesses.whatsappPhone,
      views: sql<number>`coalesce(sum(${analyticsDaily.views}), 0)`,
      waClicks: sql<number>`coalesce(sum(${analyticsDaily.waClicks}), 0)`,
    })
    .from(analyticsDaily)
    .innerJoin(businesses, eq(businesses.id, analyticsDaily.businessId))
    .where(
      and(
        eq(businesses.status, "published"),
        gte(analyticsDaily.day, new Date(`${month.start}T00:00:00Z`)),
        lte(analyticsDaily.day, new Date(`${month.end}T00:00:00Z`)),
      ),
    )
    .groupBy(businesses.id, businesses.name, businesses.slug, businesses.whatsappPhone);

  const monthItems: QueueItem[] = monthly
    .filter((m) => Number(m.views) > 0)
    .map((m) => ({
      businessId: m.businessId,
      businessName: m.businessName,
      slug: m.slug,
      whatsappPhone: m.whatsappPhone,
      kind: "monthly_stats" as const,
      periodKey: month.key,
      views: Number(m.views),
      waClicks: Number(m.waClicks),
      monthLabel: month.label,
    }));

  if (monthItems.length > 0) {
    const leadCounts = await db
      .select({ businessId: siteLeads.businessId, n: count() })
      .from(siteLeads)
      .where(
        and(
          inArray(siteLeads.businessId, monthItems.map((m) => m.businessId)),
          gte(siteLeads.createdAt, new Date(`${month.start}T03:00:00Z`)),
          lte(siteLeads.createdAt, new Date(`${toDayString(addDays(month.end, 1))}T03:00:00Z`)),
        ),
      )
      .groupBy(siteLeads.businessId);
    for (const m of monthItems) m.leads = Number(leadCounts.find((l) => l.businessId === m.businessId)?.n ?? 0);
  }

  const all = [...renewals, ...monthItems];
  if (all.length === 0) return [];

  const sent = await db
    .select({ businessId: outboundMessages.businessId, kind: outboundMessages.kind, periodKey: outboundMessages.periodKey })
    .from(outboundMessages)
    .where(inArray(outboundMessages.businessId, [...new Set(all.map((a) => a.businessId))]));
  const sentKeys = new Set(sent.map((s) => `${s.businessId}|${s.kind}|${s.periodKey}`));
  return all.filter((a) => !sentKeys.has(`${a.businessId}|${a.kind}|${a.periodKey}`));
}

export async function recordMessageSent(params: {
  businessId: number;
  kind: string;
  periodKey: string;
  actorUserId: number | null;
  channel?: "manual" | "api";
}): Promise<void> {
  await db
    .insert(outboundMessages)
    .values({
      businessId: params.businessId,
      kind: params.kind,
      periodKey: params.periodKey,
      actorUserId: params.actorUserId,
      channel: params.channel ?? "manual",
    })
    .onDuplicateKeyUpdate({ set: { periodKey: sql`period_key` } });
}

export async function listRecentMessages(limit = 30) {
  return db
    .select({
      id: outboundMessages.id,
      businessName: businesses.name,
      kind: outboundMessages.kind,
      periodKey: outboundMessages.periodKey,
      channel: outboundMessages.channel,
      sentAt: outboundMessages.sentAt,
    })
    .from(outboundMessages)
    .innerJoin(businesses, eq(businesses.id, outboundMessages.businessId))
    .orderBy(desc(outboundMessages.sentAt))
    .limit(limit);
}

/** Autopublicerade sajter som väntar på din titt. */
export async function listNeedsReview() {
  return db
    .select({ id: businesses.id, name: businesses.name, slug: businesses.slug, publishedAt: businesses.publishedAt })
    .from(businesses)
    .where(and(eq(businesses.needsReview, true), eq(businesses.status, "published")))
    .orderBy(desc(businesses.publishedAt))
    .limit(100);
}
