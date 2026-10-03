import { currentUser } from "@/lib/session";
import { clientIpFrom } from "@/lib/client-ip";
import { pruneRateLimits, rateLimit } from "@/lib/rate-limit";
import { pushSubscriptionSchema, removeSubscription, saveSubscription } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telefonens push-prenumeration (crm-1). Middleware släpper inte igenom /api/,
 * så sessionen kontrolleras här: bara owner, och businessId kommer ur
 * sessionen — aldrig ur bodyn. Superadmin får 403 (ingen tenant att gissa).
 */
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function owner(req: Request) {
  const user = await currentUser();
  if (!user?.userId || !user.role) return { res: json({ error: "No autorizado." }, 401) } as const;
  if (user.role !== "owner" || !user.businessId) return { res: json({ error: "Prohibido." }, 403) } as const;
  const key = `push:${user.userId}:${clientIpFrom(req.headers)}`;
  if (!rateLimit(key, 20, 10 * 60_000).ok) return { res: json({ error: "Demasiados intentos. Probá en unos minutos." }, 429) } as const;
  if (Math.random() < 0.02) pruneRateLimits();
  return { userId: user.userId, businessId: user.businessId } as const;
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const who = await owner(req);
  if ("res" in who) return who.res;

  const parsed = pushSubscriptionSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Solicitud inválida." }, 400);

  await saveSubscription({
    userId: who.userId,
    businessId: who.businessId,
    sub: parsed.data,
    userAgent: req.headers.get("user-agent"),
  });
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const who = await owner(req);
  if ("res" in who) return who.res;

  const parsed = pushSubscriptionSchema.pick({ endpoint: true }).safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Solicitud inválida." }, 400);

  await removeSubscription(who.businessId, parsed.data.endpoint);
  return json({ ok: true });
}
