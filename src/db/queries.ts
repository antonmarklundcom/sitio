import "server-only";
import { and, desc, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import { db } from "./index";
import { businesses, payments, subscriptions } from "./schema";
import type { BusinessStatus } from "@/lib/business";

export type BusinessListRow = {
  id: number;
  slug: string;
  name: string;
  category: string;
  themeKey: string;
  status: BusinessStatus;
  city: string;
  zone: string | null;
  whatsappVerifiedAt: Date | null;
  hotLead: boolean;
  upsellScore: number;
  publishedAt: Date | null;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: Date | string | null;
  pendingPayments: number;
};

export async function listBusinesses(params: {
  q?: string;
  status?: BusinessStatus | "all";
}): Promise<BusinessListRow[]> {
  const filters = [];
  if (params.q) {
    const needle = `%${params.q}%`;
    filters.push(
      or(like(businesses.name, needle), like(businesses.slug, needle), like(businesses.city, needle)),
    );
  }
  if (params.status && params.status !== "all") {
    filters.push(eq(businesses.status, params.status));
  }

  // Senaste prenumerationen per business samt antal obekräftade betalningar.
  const rows = await db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      category: businesses.category,
      themeKey: businesses.themeKey,
      status: businesses.status,
      city: businesses.city,
      zone: businesses.zone,
      whatsappVerifiedAt: businesses.whatsappVerifiedAt,
      hotLead: businesses.hotLead,
      upsellScore: businesses.upsellScore,
      publishedAt: businesses.publishedAt,
      subscriptionStatus: sql<string | null>`(
        select s.status from subscriptions s
        where s.business_id = ${businesses.id}
        order by s.expires_at desc limit 1
      )`,
      subscriptionExpiresAt: sql<string | null>`(
        select s.expires_at from subscriptions s
        where s.business_id = ${businesses.id}
        order by s.expires_at desc limit 1
      )`,
      pendingPayments: sql<number>`(
        select count(*) from payments p
        where p.business_id = ${businesses.id} and p.status = 'reported'
      )`,
    })
    .from(businesses)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(businesses.updatedAt))
    .limit(300);

  return rows as BusinessListRow[];
}

export async function getBusinessById(id: number) {
  const rows = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getBusinessBySlug(slug: string) {
  const rows = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getPublishedSlugs() {
  return db
    .select({ slug: businesses.slug, updatedAt: businesses.updatedAt })
    .from(businesses)
    .where(eq(businesses.status, "published"));
}

export async function countByStatus(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: businesses.status, n: sql<number>`count(*)` })
    .from(businesses)
    .groupBy(businesses.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

export async function getSubscriptionsExpiringWithin(days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return db
    .select()
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.status, ["active", "grace"]),
        gte(subscriptions.expiresAt, new Date()),
        sql`${subscriptions.expiresAt} <= ${cutoff}`,
      ),
    )
    .orderBy(subscriptions.expiresAt);
}

export async function getPaymentsForBusiness(businessId: number) {
  return db
    .select()
    .from(payments)
    .where(eq(payments.businessId, businessId))
    .orderBy(desc(payments.createdAt));
}
