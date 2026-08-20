import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/session";

/**
 * Första lagret, inte skyddet i sig. Varje sida och mutation kallar ändå
 * requireRole() server-side — middleware finns för att slippa rendera
 * adminskalet åt en utloggad besökare.
 */
const SESSION_COOKIE = "sitio_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login") return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // Felkonfigurerad miljö ska failas synligt, inte tolkas som "inloggad".
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, {
    password: secret,
    cookieName: SESSION_COOKIE,
  });

  if (session.role !== "superadmin") {
    const url = new URL("/admin/login", req.url);
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
