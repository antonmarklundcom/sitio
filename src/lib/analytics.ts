import "server-only";
import { createHash, createHmac } from "node:crypto";
import { clientIpFrom } from "./client-ip";
import { env } from "./env";
import { PY_TIMEZONE } from "./hours";

/**
 * Analytics-ingest: klassning och hashning. Ingen PII lagras — varken IP,
 * user agent eller full referrer lämnar den här filen.
 */

export const EVENT_TYPES = [
  "page_view",
  "whatsapp_click",
  "phone_click",
  "map_click",
  "social_click",
  "menu_view",
  "gallery_view",
  "products_view",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(v: unknown): v is EventType {
  return typeof v === "string" && (EVENT_TYPES as readonly string[]).includes(v);
}

/**
 * Beaconens `l` (vilken CTA, R3-18). Värdena kommer från våra egna
 * `data-ev-loc`-attribut, men endpointen är publik: allt som inte ser ut som
 * ett av dem blir null i stället för att hamna i databasen.
 */
export function ctaLocation(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const loc = v.trim().toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(loc) ? loc : null;
}

export type DeviceType = "mobile" | "desktop" | "bot" | "unknown";

/**
 * UA-klassning. Bots lagras men räknas aldrig in i siffrorna (rollup filtrerar
 * bort dem) — att kasta dem vid ingest hade gjort det omöjligt att se om en
 * sajt plötsligt bara får botttrafik.
 *
 * Listan är avsiktligt kort: den fångar de självdeklarerande botarna. En bot
 * som kör JS och ljuger om sin UA kan inte filtreras här, och det låtsas vi
 * inte heller att den kan.
 */
const BOT_PATTERN =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pagespeed|gtmetrix|curl|wget|python-requests|axios|go-http-client|monitor|uptime|pingdom|semrush|ahrefs|mj12|dotbot|petalbot|yandex|baidu|duckduck/i;
const MOBILE_PATTERN = /android|iphone|ipad|ipod|mobile|opera mini|iemobile|windows phone/i;

export function classifyDevice(userAgent: string | null): DeviceType {
  if (!userAgent) return "unknown";
  if (BOT_PATTERN.test(userAgent)) return "bot";
  if (MOBILE_PATTERN.test(userAgent)) return "mobile";
  return "desktop";
}

/** Dagsnyckel i Asunción — dygnsgränsen ska följa kundens dygn, inte UTC:s. */
export function dayKeyAsuncion(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * visitorHash = sha256(ip + ua + dagsalt), trunkerad till 32 tecken.
 *
 * Saltet härleds ur SESSION_SECRET och dagens datum, så det behöver aldrig
 * lagras och roterar av sig självt vid midnatt: hashen går inte att koppla
 * ihop mellan två dygn, och en läckt databas går inte att baklängesräkna till
 * IP-adresser.
 */
export function visitorHash(ip: string, userAgent: string, day: string): string {
  const salt = createHmac("sha256", env.sessionSecret).update(`ev-salt:${day}`).digest("hex");
  return createHash("sha256").update(`${ip}|${userAgent}|${salt}`).digest("hex").slice(0, 32);
}

/** Klient-IP: se src/lib/client-ip.ts (R3-27). Behåller namnet för anroparna. */
export function clientIp(headers: Headers): string {
  return clientIpFrom(headers);
}

/** Bara värdnamnet sparas — en full referrer kan innehålla söktermer och id:n. */
export function referrerHost(raw: unknown, ownHost: string | null): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (!host || host === ownHost?.toLowerCase()) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}
