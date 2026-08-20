import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
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

export async function currentUser(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session.userId || !session.role) return null;
  return {
    userId: session.userId,
    role: session.role,
    name: session.name,
    businessId: session.businessId,
  };
}
