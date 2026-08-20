import "server-only";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, users } from "@/db/schema";
import { currentUser, getSession, type Role, type SessionData } from "./session";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Enda porten till skyddat innehåll. Varje sida och varje mutation kallar
 * denna — middleware är bara ett första lager, aldrig skyddet i sig.
 *
 * Redirectar till rätt inloggning när sessionen saknas; kastar ForbiddenError
 * när sessionen finns men rollen inte räcker (fel roll ska inte tyst skickas
 * till en inloggningssida där den redan är inloggad).
 */
export async function requireRole(...allowed: Role[]): Promise<Required<Pick<SessionData, "userId" | "role">> & SessionData> {
  const user = await currentUser();
  const loginPath = allowed.includes("superadmin") ? "/admin/login" : "/mi-sitio/login";

  if (!user?.userId || !user.role) redirect(loginPath);
  if (!allowed.includes(user.role)) throw new ForbiddenError();

  return user as Required<Pick<SessionData, "userId" | "role">> & SessionData;
}

/** Owner-scoping: kastar om sessionen inte äger businessId:t. Superadmin passerar. */
export async function assertBusinessAccess(businessId: number): Promise<void> {
  const user = await currentUser();
  if (!user) throw new ForbiddenError();
  if (user.role === "superadmin") return;
  if (user.businessId !== businessId) throw new ForbiddenError();
}

export async function logActivity(params: {
  actorUserId?: number | null;
  businessId?: number | null;
  action: string;
  meta?: unknown;
}): Promise<void> {
  await db.insert(activityLog).values({
    actorUserId: params.actorUserId ?? null,
    businessId: params.businessId ?? null,
    action: params.action,
    metaJson: params.meta ?? null,
  });
}

export async function findActiveSuperadminByEmail(email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.role, "superadmin"), eq(users.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

export async function establishSession(data: {
  userId: number;
  role: Role;
  name: string;
  businessId?: number;
}): Promise<void> {
  const session = await getSession();
  session.userId = data.userId;
  session.role = data.role;
  session.name = data.name;
  session.businessId = data.businessId;
  await session.save();

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, data.userId));
}

export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
