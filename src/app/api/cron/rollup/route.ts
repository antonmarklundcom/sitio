import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/analytics";
import { rateLimit } from "@/lib/rate-limit";
import { revalidatePath, revalidateTag } from "next/cache";
import { runBillingLifecycle } from "@/lib/billing-lifecycle";
import { runRollup } from "@/lib/rollup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Nattlig rollup. Körs av hPanel-cron:
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<domän>/api/cron/rollup
 *
 * Routen gör två saker per dygn:
 *   1. rullar upp analytics_events → analytics_daily och prunar råeventen,
 *   2. kör prenumerationernas livscykelsteg (active → grace → expired ⇒ sajten
 *      pausas).
 *
 * För analytics finns en lazy fallback i src/lib/rollup.ts vid första
 * adminläsningen per dygn. Livscykeln har medvetet INGEN lazy fallback: den
 * ändrar status på sajter och får inte hända som sidoeffekt av en läsning.
 * Sätts cron aldrig upp körs den i stället manuellt från /admin/pagos, och den
 * vyn säger till när den senast kördes.
 */
function authorized(req: Request): boolean {
  const expected = env.cronSecret;
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const url = new URL(req.url);
  const provided = bearer || url.searchParams.get("key") || "";

  // Längdskillnad läcker inget mer än timingSafeEqual redan gör med
  // olika längder — men den kastar, så den måste kollas först.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

async function handle(req: Request) {
  // Även med hemlighet: ett publikt endpoint som gör en aggregering ska inte
  // gå att hamra på i en loop.
  if (!rateLimit(`cron:${clientIp(req.headers)}`, 10, 60_000).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const days = Number(new URL(req.url).searchParams.get("days"));
  const rollup = await runRollup(Number.isFinite(days) && days > 0 ? days : undefined);
  const lifecycle = await runBillingLifecycle(null);

  // Pausade sajter måste ur ISR-cachen direkt, annars fortsätter noden servera
  // en sajt som inte längre är betald.
  for (const slug of lifecycle.pausedBusinesses) revalidateTag(`biz:${slug}`);
  if (lifecycle.pausedBusinesses.length > 0) {
    revalidatePath("/sitemap.xml");
    revalidatePath("/admin");
  }

  return NextResponse.json({ ok: true, rollup, lifecycle });
}

export const GET = handle;
export const POST = handle;
