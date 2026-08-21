import "server-only";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import { activityLog, businesses, users, verifications } from "./schema";

export type OwnerAccountRow = {
  userId: number;
  name: string;
  phone: string | null;
  status: string;
  lastLoginAt: Date | null;
  businessId: number;
  businessName: string;
  slug: string;
  businessStatus: string;
  /** Senaste inloggningsbegäran som ännu inte följts av en lyckad inloggning. */
  requestedAt: Date | null;
  /** En kod som är utskickad och fortfarande giltig. */
  pendingCode: boolean;
};

/**
 * Owner-konton med deras sajt, senaste inloggningsbegäran och om det finns en
 * aktiv kod. Adminvyn /admin/accesos är arbetsytan tills Cloud API (PR-17)
 * skickar koderna själv.
 */
export async function listOwnerAccounts(limit = 200): Promise<OwnerAccountRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      phone: users.phone,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      businessId: businesses.id,
      businessName: businesses.name,
      slug: businesses.slug,
      businessStatus: businesses.status,
      requestedAt: sql<Date | null>`(
        select max(a.created_at) from activity_log a
        where a.actor_user_id = \`users\`.\`id\`
          and a.action = 'owner_login_requested'
          and a.created_at > utc_timestamp() - interval 2 hour
      )`,
      pendingCode: sql<number>`(
        select count(*) from verifications v
        where v.user_id = \`users\`.\`id\`
          and v.purpose = 'login'
          and v.verified_at is null
          and v.expires_at > utc_timestamp()
      )`,
    })
    .from(users)
    .innerJoin(businesses, eq(businesses.ownerUserId, users.id))
    .where(eq(users.role, "owner"))
    .orderBy(desc(users.lastLoginAt), desc(users.id))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    requestedAt: r.requestedAt ? new Date(r.requestedAt) : null,
    pendingCode: Number(r.pendingCode) > 0,
  })) as OwnerAccountRow[];
}

/** Inloggningsförsök från nummer utan konto — värt att se, inte att agera på blint. */
export async function listUnknownLoginAttempts(limit = 20) {
  return db
    .select({ id: activityLog.id, metaJson: activityLog.metaJson, createdAt: activityLog.createdAt })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.action, "owner_login_requested_unknown"),
        gt(activityLog.createdAt, new Date(Date.now() - 24 * 3600_000)),
      ),
    )
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
}

/** Aktiv, overifierad inloggningskod för ett owner-konto. */
export async function getActiveLoginVerification(userId: number) {
  const rows = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.userId, userId),
        eq(verifications.purpose, "login"),
        isNull(verifications.verifiedAt),
      ),
    )
    .orderBy(desc(verifications.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
