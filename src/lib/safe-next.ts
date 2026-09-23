import { routeArea, type RouteArea } from "./route-area";

/**
 * `?next=` efter inloggning (R3-42). Middleware sätter den när en utloggad
 * besökare skickas till inloggningen; här släpps den bara igenom om den är en
 * relativ sökväg på samma sajt och ligger i samma yta som inloggningen.
 * Allt annat — `//evil.com`, `/\evil.com`, `https://…`, `javascript:`,
 * kontrolltecken, en annan yta — ger `fallback`. Ingen öppen redirect.
 */
export function safeNext(raw: unknown, area: Exclude<RouteArea, "public">, fallback: string): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 300) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, "http://sitio.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://sitio.invalid") return fallback;
  if (routeArea(url.pathname) !== area) return fallback;
  return url.pathname + url.search;
}
