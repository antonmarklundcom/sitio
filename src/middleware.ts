import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/session";

const SESSION_COOKIE = "sitio_session";

/**
 * Två uppgifter:
 *
 * 1. Skydda /admin/* och /mi-sitio/* som första lager. Varje sida och mutation
 *    kallar ändå requireRole() server-side — middleware finns för att slippa
 *    rendera panelen åt en utloggad besökare.
 * 2. Skriva om /{slug}?preview=<token> till /preview/{slug}. Kunden och du
 *    ser samma URL som planen anger, men den publika /[slug] slipper läsa
 *    searchParams och kan därmed ligga kvar på ISR.
 */
export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  const isAdmin = pathname.startsWith("/admin");
  const isOwner = pathname.startsWith("/mi-sitio");

  if (!isAdmin && !isOwner) {
    if (searchParams.has("preview") && /^\/[^/]+$/.test(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = `/preview${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  const loginPath = isOwner ? "/mi-sitio/login" : "/admin/login";
  if (pathname === loginPath) return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // Felkonfigurerad miljö ska failas synligt, inte tolkas som "inloggad".
    return NextResponse.redirect(new URL(loginPath, req.url));
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, {
    password: secret,
    cookieName: SESSION_COOKIE,
  });

  // Superadmin kommer åt /mi-sitio också — annars går det inte att felsöka en
  // kunds vy. Motsatsen gäller aldrig: en owner har inget i /admin att göra.
  const allowed = isOwner ? session.role === "owner" || session.role === "superadmin" : session.role === "superadmin";
  if (!allowed) {
    const url = new URL(loginPath, req.url);
    if (pathname !== "/admin" && pathname !== "/mi-sitio") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Statiska filer, bilder och API-routes går aldrig genom middleware.
  matcher: ["/((?!api|_next/static|_next/image|media|favicon.ico|robots.txt|sitemap.xml).*)"],
};
