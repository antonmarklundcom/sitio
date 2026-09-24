import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { businessModules, businesses, siteLeads } from "@/db/schema";
import { clientIpFrom } from "@/lib/client-ip";
import { pruneRateLimits, rateLimit } from "@/lib/rate-limit";
import { todayAsuncion } from "@/lib/billing";
import { waLink } from "@/lib/format";
import { siteLeadSchema, siteOptions, turnoDayProblem, visitorWhatsappMessage } from "@/lib/growth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Consultas och turno-förfrågningar från kundsajterna (growth-1). Publik
 * endpoint, så: tak per IP och per sajt, honeypot, bara publicerade sajter
 * med formuläret påslaget (turno kräver booking-modulen). Samma generiska
 * felmeddelande när sajten inte tar emot — inget att räkna upp.
 */
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

const UNAVAILABLE = { error: "Este formulario no está disponible. Escribinos por WhatsApp." };

export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers);
  if (!rateLimit(`consulta:${ip}`, 5, 10 * 60_000).ok) {
    return json({ error: "Enviaste varias consultas seguidas. Probá en unos minutos o escribinos por WhatsApp." }, 429);
  }
  if (Math.random() < 0.02) pruneRateLimits();

  let body: Record<string, unknown>;
  try {
    const raw: unknown = await req.json();
    if (typeof raw !== "object" || raw === null) return json({ error: "Solicitud inválida." }, 400);
    body = raw as Record<string, unknown>;
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }

  // Honeypot: en bot som fyller allt får ett "ok" och inget sparas.
  if (typeof body.website === "string" && body.website !== "") return json({ ok: true });

  const businessId = Number(body.b);
  if (!Number.isInteger(businessId) || businessId <= 0) return json(UNAVAILABLE, 404);

  const str = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : undefined);
  const parsed = siteLeadSchema.safeParse({
    kind: str("kind"),
    name: str("name"),
    phone: str("phone") ?? "",
    message: str("message"),
    service: str("service"),
    day: str("day"),
    time: str("time"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "_")] ??= issue.message;
    return json({ error: "Revisá los datos marcados.", fieldErrors }, 422);
  }
  const lead = parsed.data;

  const dayProblem = lead.kind === "turno" ? turnoDayProblem(lead.day, todayAsuncion()) : null;
  if (dayProblem) return json({ error: "Revisá los datos marcados.", fieldErrors: { day: dayProblem } }, 422);

  const [business] = await db
    .select({ id: businesses.id, status: businesses.status, whatsappPhone: businesses.whatsappPhone, options: businesses.siteOptionsJson })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!business || business.status !== "published") return json(UNAVAILABLE, 404);

  if (lead.kind === "turno") {
    const [booking] = await db
      .select({ on: businessModules.isEnabled })
      .from(businessModules)
      .where(and(eq(businessModules.businessId, businessId), eq(businessModules.moduleKey, "booking")))
      .limit(1);
    if (!booking?.on) return json(UNAVAILABLE, 404);
  } else if (!siteOptions(business.options).leadForm) {
    return json(UNAVAILABLE, 404);
  }

  // Tak per sajt: en spamvåg ska inte kunna fylla en kunds inkorg.
  if (!rateLimit(`consulta-biz:${businessId}`, 60, 24 * 60 * 60_000).ok) {
    return json({ error: "No pudimos recibir tu consulta ahora. Escribinos por WhatsApp." }, 429);
  }

  await db.insert(siteLeads).values({
    businessId,
    kind: lead.kind,
    name: lead.name,
    phone: lead.phone,
    message: lead.message || null,
    serviceName: lead.kind === "turno" && lead.service ? lead.service : null,
    requestedDay: lead.kind === "turno" && lead.day ? new Date(`${lead.day}T00:00:00Z`) : null,
    requestedTime: lead.kind === "turno" && lead.time ? lead.time : null,
  });

  return json({ ok: true, wa: waLink(business.whatsappPhone, visitorWhatsappMessage(lead)) });
}
