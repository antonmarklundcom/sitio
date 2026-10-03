import "server-only";
import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions, type PushSubscription } from "@/db/schema";
import type { NewLeadNotice } from "./lead-notify";

/**
 * Web Push till ägarens telefon (crm-1). Gratis, ingen tredjepart utöver
 * webbläsarens egen push-tjänst. VAPID-nycklarna kommer ur miljön; saknas de
 * är allt här tyst av. Inget i filen får kasta ut till anroparen.
 */

export const MAX_SUBSCRIPTIONS_PER_BUSINESS = 10;
export const MAX_FAILURES = 5;
const TTL_SECONDS = 60 * 60 * 24;

/** Samma längder som kolumnerna i push_subscriptions. */
export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(2000)
    .url()
    .refine((v) => v.startsWith("https://"), "endpoint måste vara https"),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(64),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export function endpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

export type PushPayload = { title: string; body: string; url: string; tag: string };

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function dayEs(day: string): string {
  const [y, m, d] = day.split("-");
  return y && m && d ? `${d}/${m}` : day;
}

/** Ren: texten som visas på låsskärmen. */
export function buildLeadPayload(lead: NewLeadNotice, businessName: string): PushPayload {
  const name = clip(lead.name, 60) || "Alguien";
  let body: string;
  if (lead.kind === "turno") {
    const what = [lead.serviceName ? clip(lead.serviceName, 60) : null, lead.requestedDay ? dayEs(lead.requestedDay) : null, lead.requestedTime]
      .filter(Boolean)
      .join(" · ");
    body = what ? `${name}: ${what}` : name;
  } else {
    body = lead.message ? `${name}: ${clip(lead.message, 100)}` : name;
  }
  return {
    title: lead.kind === "turno" ? "Nuevo turno" : "Nueva consulta",
    body: clip(`${body} — ${businessName}`, 160),
    url: "/mi-sitio/clientes",
    tag: `lead-${lead.leadId}`,
  };
}

export type SendOutcome = "ok" | "gone" | "error";
export type FailureDecision = { action: "delete" } | { action: "update"; failures: number; markOk: boolean };

/** Ren: vad som händer med en prenumeration efter ett sändningsförsök. */
export function decideAfterSend(outcome: SendOutcome, failures: number): FailureDecision {
  if (outcome === "ok") return { action: "update", failures: 0, markOk: true };
  if (outcome === "gone") return { action: "delete" };
  const next = failures + 1;
  return next >= MAX_FAILURES ? { action: "delete" } : { action: "update", failures: next, markOk: false };
}

export function outcomeFromStatus(statusCode: number | undefined): SendOutcome {
  return statusCode === 404 || statusCode === 410 ? "gone" : "error";
}

let vapidReady: boolean | null = null;
function configureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return (vapidReady = false);
  try {
    webpush.setVapidDetails(subject, pub, priv);
    vapidReady = true;
  } catch {
    vapidReady = false;
  }
  return vapidReady;
}

export function pushConfigured(): boolean {
  return configureVapid();
}

async function sendOne(sub: PushSubscription, payload: PushPayload): Promise<SendOutcome> {
  let outcome: SendOutcome;
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: TTL_SECONDS, urgency: "high", timeout: 10_000 },
    );
    outcome = "ok";
  } catch (err) {
    outcome = outcomeFromStatus((err as { statusCode?: number }).statusCode);
  }
  try {
    const decision = decideAfterSend(outcome, sub.failures);
    if (decision.action === "delete") {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    } else {
      await db
        .update(pushSubscriptions)
        .set({ failures: decision.failures, ...(decision.markOk ? { lastOkAt: new Date() } : {}) })
        .where(eq(pushSubscriptions.id, sub.id));
    }
  } catch {
    // Bokföringen är en bonus.
  }
  return outcome;
}

async function sendToBusiness(businessId: number, payload: PushPayload): Promise<number> {
  if (!configureVapid()) return 0;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.businessId, businessId));
  const results = await Promise.all(subs.map((s) => sendOne(s, payload)));
  return results.filter((r) => r === "ok").length;
}

/** Ny consulta/turno → ägarens telefoner. Får aldrig kasta. */
export async function sendLeadPush(lead: NewLeadNotice, businessName: string): Promise<void> {
  try {
    await sendToBusiness(lead.businessId, buildLeadPayload(lead, businessName));
  } catch {
    // Consultan är redan sparad.
  }
}

/** Testknappen: hur många telefoner som tog emot avisot. Kastar aldrig. */
export async function sendTestPush(businessId: number): Promise<{ configured: boolean; sent: number }> {
  if (!configureVapid()) return { configured: false, sent: 0 };
  try {
    const sent = await sendToBusiness(businessId, {
      title: "Aviso de prueba",
      body: "¡Funciona! Así te vamos a avisar cuando llegue una consulta.",
      url: "/mi-sitio/clientes",
      tag: "test",
    });
    return { configured: true, sent };
  } catch {
    return { configured: true, sent: 0 };
  }
}

/** Upsert på endpoint-hashen; äldsta prenumerationerna över taket tas bort. */
export async function saveSubscription(params: {
  userId: number;
  businessId: number;
  sub: PushSubscriptionInput;
  userAgent: string | null;
}): Promise<void> {
  const { userId, businessId, sub } = params;
  const hash = endpointHash(sub.endpoint);
  const ua = params.userAgent ? params.userAgent.slice(0, 160) : null;
  await db
    .insert(pushSubscriptions)
    .values({ userId, businessId, endpointHash: hash, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: ua })
    .onDuplicateKeyUpdate({
      set: { userId, businessId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: ua, failures: 0 },
    });

  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.businessId, businessId))
    .orderBy(asc(pushSubscriptions.createdAt), asc(pushSubscriptions.id));
  const excess = rows.length - MAX_SUBSCRIPTIONS_PER_BUSINESS;
  if (excess > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, rows.slice(0, excess).map((r) => r.id)));
  }
}

export async function removeSubscription(businessId: number, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.businessId, businessId), eq(pushSubscriptions.endpointHash, endpointHash(endpoint))));
}
