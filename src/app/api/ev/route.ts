import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents, businesses } from "@/db/schema";
import {
  classifyDevice,
  clientIp,
  dayKeyAsuncion,
  isEventType,
  referrerHost,
  visitorHash,
} from "@/lib/analytics";
import { pruneRateLimits, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Analytics-ingest. Tar emot beaconen från kundsajternas inline-script
 * (src/components/site/site-scripts.tsx).
 *
 * Svarar ALLTID 204, även när eventet kastas: endpointen är publik, och en
 * differentierad statuskod hade gjort den till ett verktyg för att räkna upp
 * vilka business-id som finns. Loggning av avvisade event sker inte heller —
 * en botvåg ska inte kunna fylla serverloggen.
 */
const NO_CONTENT = new Response(null, { status: 204 });

/** Publicerad-kontroll cachad i 5 min: en beacon får aldrig kosta en DB-slag. */
const publishedBusiness = unstable_cache(
  async (id: number) => {
    const rows = await db
      .select({ id: businesses.id, status: businesses.status })
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);
    return rows[0]?.status === "published" ? rows[0].id : null;
  },
  ["ev-business"],
  { revalidate: 300 },
);

export async function POST(req: Request) {
  const ip = clientIp(req.headers);

  // Två tak: ett per IP totalt, ett per IP och minut för själva skrivningen.
  // Rate limit i processminne räcker — vi kör en enda Node-process (se
  // src/lib/rate-limit.ts).
  if (!rateLimit(`ev:${ip}`, 120, 60_000).ok) return NO_CONTENT;
  if (Math.random() < 0.01) pruneRateLimits();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NO_CONTENT;
  }
  if (typeof payload !== "object" || payload === null) return NO_CONTENT;

  const body = payload as Record<string, unknown>;
  const businessId = Number(body.b);
  const type = body.t;

  if (!Number.isInteger(businessId) || businessId <= 0) return NO_CONTENT;
  if (!isEventType(type)) return NO_CONTENT;

  const verified = await publishedBusiness(businessId);
  if (verified === null) return NO_CONTENT;

  const userAgent = req.headers.get("user-agent") ?? "";
  const deviceType = classifyDevice(userAgent);
  const path = typeof body.p === "string" ? body.p.slice(0, 120) : null;

  let ownHost: string | null = null;
  try {
    ownHost = new URL(req.url).hostname;
  } catch {
    ownHost = null;
  }

  await db.insert(analyticsEvents).values({
    businessId: verified,
    type,
    path,
    referrerHost: referrerHost(body.r, ownHost),
    deviceType,
    visitorHash: visitorHash(ip, userAgent, dayKeyAsuncion()),
  });

  return NO_CONTENT;
}
