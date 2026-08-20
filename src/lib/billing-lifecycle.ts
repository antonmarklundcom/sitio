import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { businesses, subscriptions } from "@/db/schema";
import { logActivity } from "./auth";
import { GRACE_DAYS, addDays, lifecycleStatus, toDayString, type SubscriptionStatus } from "./billing";

export type LifecycleResult = {
  toGrace: number;
  toExpired: number;
  pausedBusinesses: string[];
};

/**
 * Dagligt livscykelsteg (PLAN.md §1.7): active → grace (15 dgr, sajten uppe)
 * → expired ⇒ business `paused` (sajten svarar 404 + noindex, datat finns kvar).
 *
 * Körs av /api/cron/rollup, i samma anrop som analytics-rollupen, och kan
 * köras manuellt från /admin/pagos. Den är idempotent: en prenumeration som
 * redan står i rätt status rörs inte, och en sajt som redan är pausad pausas
 * inte igen.
 *
 * Funktionen returnerar vilka slugs som pausades i stället för att själv
 * invalidera ISR-cachen — `revalidateTag` får inte anropas under en render,
 * och den här koden kan nås både från en route handler och från en
 * serveråtgärd. Anroparen som VET att den får revalidera gör det.
 */
export async function runBillingLifecycle(actorUserId?: number | null): Promise<LifecycleResult> {
  const today = new Date();

  const due = await db
    .select({
      id: subscriptions.id,
      businessId: subscriptions.businessId,
      status: subscriptions.status,
      expiresAt: subscriptions.expiresAt,
    })
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.status, ["trial", "active", "grace"]),
        lt(subscriptions.expiresAt, new Date(`${toDayString(today)}T00:00:00Z`)),
      ),
    )
    .limit(1000);

  const result: LifecycleResult = { toGrace: 0, toExpired: 0, pausedBusinesses: [] };
  if (due.length === 0) return result;

  for (const row of due) {
    const next = lifecycleStatus(row.status as SubscriptionStatus, row.expiresAt, today);
    if (next === row.status) continue;

    await db.update(subscriptions).set({ status: next }).where(eq(subscriptions.id, row.id));

    if (next === "grace") result.toGrace += 1;
    if (next === "expired") result.toExpired += 1;

    await logActivity({
      actorUserId: actorUserId ?? null,
      businessId: row.businessId,
      action: `subscription_${next}`,
      meta: { from: row.status, expiresAt: toDayString(row.expiresAt), graceDays: GRACE_DAYS },
    });

    // Först vid `expired` pausas sajten. Under respiten står den kvar uppe —
    // det är hela poängen med respiten.
    if (next === "expired") {
      const [business] = await db
        .select({ id: businesses.id, slug: businesses.slug, status: businesses.status })
        .from(businesses)
        .where(eq(businesses.id, row.businessId))
        .limit(1);

      if (business && business.status === "published") {
        await db.update(businesses).set({ status: "paused" }).where(eq(businesses.id, business.id));
        result.pausedBusinesses.push(business.slug);
        await logActivity({
          actorUserId: actorUserId ?? null,
          businessId: business.id,
          action: "status_paused",
          meta: { reason: "subscription_expired" },
        });
      }
    }
  }

  return result;
}

/** Nästa förfallodatum vid bekräftad betalning: förläng, aldrig förkorta. */
export function extendedExpiry(currentExpiresAt: Date | string, periodEnd: Date | string): Date {
  const current = new Date(`${toDayString(currentExpiresAt)}T00:00:00Z`);
  const next = new Date(`${toDayString(periodEnd)}T00:00:00Z`);
  return next > current ? next : current;
}

export { addDays };
