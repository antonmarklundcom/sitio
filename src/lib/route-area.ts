/**
 * Vilken yta en sökväg hör till, för middleware (R3-31). Hela segment, inte
 * prefix: `/administradora-lopez` är en kundsajt, inte adminet, och
 * `/mi-sitio-web` är inte ägarpanelen. Edge-säker — inga Node-importer.
 */
export type RouteArea = "admin" | "owner" | "public";

function underSegment(pathname: string, segment: string): boolean {
  return pathname === segment || pathname.startsWith(`${segment}/`);
}

export function routeArea(pathname: string): RouteArea {
  if (underSegment(pathname, "/admin")) return "admin";
  if (underSegment(pathname, "/mi-sitio")) return "owner";
  return "public";
}
