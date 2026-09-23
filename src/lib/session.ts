import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, users } from "@/db/schema";
import { env } from "./env";

export type Role = "superadmin" | "owner";

export type SessionData = {
  userId?: number;
  role?: Role;
  name?: string;
  /** businessId för owner-sessioner; superadmin har ingen tenant-bindning. */
  businessId?: number;
};

export const SESSION_COOKIE = "sitio_session";

export function sessionOptions(): SessionOptions {
  return {
    password: env.sessionSecret,
    cookieName: SESSION_COOKIE,
    ttl: 60 * 60 * 24 * 30, // 30 dagar
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const store = await cookies();
  return getIronSession<SessionData>(store, sessionOptions());
}

/**
 * Cookien bevisar bara vem som loggade in, inte att kontot fortfarande får
 * vara inne (R3-34). Utan den här kontrollen behöll en avstängd owner — eller
 * den förra ägaren när WhatsApp-numret flyttats till en ny person — full
 * redigering, uppladdning och betalningsrapport i upp till 30 dagar. Kontot
 * ska vara aktivt med samma roll, och en owner ska fortfarande äga sitt
 * business. En fråga per request (React cache), inte per anrop.
 */
const sessionStillValid = cache(async (userId: number, role: Role, businessId: number | undefined): Promise<boolean> => {
  const [user] = await db
    .select({ status: users.status, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status !== "active" || user.role !== role) return false;
  if (role !== "owner") return true;
  if (!businessId) return false;
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, userId)))
    .limit(1);
  return Boolean(business);
});

export async function currentUser(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session.userId || !session.role) return null;
  if (!(await sessionStillValid(session.userId, session.role, session.businessId))) return null;
  return {
    userId: session.userId,
    role: session.role,
    name: session.name,
    businessId: session.businessId,
  };
}
