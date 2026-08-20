import "server-only";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "./index";
import { analyticsDaily, businesses, media, payments, subscriptions } from "./schema";
import { EXPIRING_SOON_DAYS, addDays, toDayString } from "@/lib/billing";
import type { Payment, Subscription } from "./schema";

/** Senaste prenumerationen för en sajt — den vi förlänger och fakturerar mot. */
export async function getCurrentSubscription(businessId: number): Promise<Subscription | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .orderBy(desc(subscriptions.expiresAt), desc(subscriptions.id))
    .limit(1);
  return rows[0] ?? null;
}

export type PaymentRow = Payment & { receiptFile: string | null };

export async function getPaymentsWithReceipts(businessId: number): Promise<PaymentRow[]> {
  const rows = await db
    .select({
      payment: payments,
      variants: media.variantsJson,
    })
    .from(payments)
    .leftJoin(media, eq(media.id, payments.receiptMediaId))
    .where(eq(payments.businessId, businessId))
    .orderBy(desc(payments.createdAt));

  return rows.map((r) => ({
    ...r.payment,
    receiptFile: r.variants?.w1600 ?? r.variants?.w800 ?? r.variants?.w400 ?? null,
  }));
}

export type PendingPaymentRow = {
  id: number;
  businessId: number;
  businessName: string;
  slug: string;
  amountGs: number;
  method: string;
  reference: string | null;
  periodStart: Date | string;
  periodEnd: Date | string;
  createdAt: Date;
};

/** Betalningar som väntar på din bekräftelse — arbetskön i /admin/pagos. */
export async function listPendingPayments(): Promise<PendingPaymentRow[]> {
  const rows = await db
    .select({
      id: payments.id,
      businessId: payments.businessId,
      businessName: businesses.name,
      slug: businesses.slug,
      amountGs: payments.amountGs,
      method: payments.method,
      reference: payments.reference,
      periodStart: payments.periodStart,
      periodEnd: payments.periodEnd,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(businesses, eq(businesses.id, payments.businessId))
    .where(eq(payments.status, "reported"))
    .orderBy(desc(payments.createdAt))
    .limit(200);

  return rows as PendingPaymentRow[];
}

export type ExpiringRow = {
  subscriptionId: number;
  businessId: number;
  businessName: string;
  slug: string;
  whatsappPhone: string;
  businessStatus: string;
  plan: string;
  priceGs: number;
  status: string;
  expiresAt: Date | string;
  views365: number;
  waClicks365: number;
};

/**
 * "Vencen pronto": prenumerationer som förfaller inom `days` dagar, plus de
 * som redan gått över i grace eller expired och alltså behöver en påminnelse
 * NU. Årsstatistiken hämtas i samma fråga — den är hela säljargumentet i
 * förnyelsemeddelandet och ska aldrig behöva ett extra klick.
 */
export async function listExpiringSoon(days = EXPIRING_SOON_DAYS): Promise<ExpiringRow[]> {
  const cutoff = toDayString(addDays(new Date(), days));

  const rows = await db
    .select({
      subscriptionId: subscriptions.id,
      businessId: businesses.id,
      businessName: businesses.name,
      slug: businesses.slug,
      whatsappPhone: businesses.whatsappPhone,
      businessStatus: businesses.status,
      plan: subscriptions.plan,
      priceGs: subscriptions.priceGs,
      status: subscriptions.status,
      expiresAt: subscriptions.expiresAt,
    })
    .from(subscriptions)
    .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
    .where(
      and(
        inArray(subscriptions.status, ["trial", "active", "grace", "expired"]),
        lte(subscriptions.expiresAt, new Date(`${cutoff}T00:00:00Z`)),
      ),
    )
    .orderBy(subscriptions.expiresAt)
    .limit(200);

  if (rows.length === 0) return [];

  const since = new Date(`${toDayString(addDays(new Date(), -365))}T00:00:00Z`);
  const stats = await db
    .select({
      businessId: analyticsDaily.businessId,
      views: sql<number>`coalesce(sum(${analyticsDaily.views}), 0)`,
      waClicks: sql<number>`coalesce(sum(${analyticsDaily.waClicks}), 0)`,
    })
    .from(analyticsDaily)
    .where(
      and(
        inArray(
          analyticsDaily.businessId,
          rows.map((r) => r.businessId),
        ),
        gte(analyticsDaily.day, since),
      ),
    )
    .groupBy(analyticsDaily.businessId);

  const byBusiness = new Map(stats.map((s) => [s.businessId, s]));

  return rows.map((r) => ({
    ...r,
    views365: Number(byBusiness.get(r.businessId)?.views ?? 0),
    waClicks365: Number(byBusiness.get(r.businessId)?.waClicks ?? 0),
  })) as ExpiringRow[];
}

/** Årsstatistik för en enskild sajt — förnyelselänken på detaljsidan. */
export async function getYearStats(businessId: number): Promise<{ views365: number; waClicks365: number }> {
  const since = new Date(`${toDayString(addDays(new Date(), -365))}T00:00:00Z`);
  const [row] = await db
    .select({
      views: sql<number>`coalesce(sum(${analyticsDaily.views}), 0)`,
      waClicks: sql<number>`coalesce(sum(${analyticsDaily.waClicks}), 0)`,
    })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.businessId, businessId), gte(analyticsDaily.day, since)));

  return { views365: Number(row?.views ?? 0), waClicks365: Number(row?.waClicks ?? 0) };
}
