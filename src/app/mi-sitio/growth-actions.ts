"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { businesses, serviceRequests, siteLeads } from "@/db/schema";
import { ensureReferralCode, getUpsellCatalog } from "@/db/growth-queries";
import { logActivity } from "@/lib/auth";
import { absoluteUrl, env } from "@/lib/env";
import { normalizePyPhone, waLink } from "@/lib/format";
import { PLAN_UPGRADE_KEY, isGoogleReviewUrl, serviceInterestMessage } from "@/lib/growth";
import { ownerContext } from "@/lib/owner-context";
import { pushLead, venderCrmConfig } from "@/lib/vendercrm";

/**
 * Owner-mutationerna för tillväxtpaketet (growth-1). Tenant kommer alltid ur
 * sessionen via ownerContext(), aldrig ur formuläret.
 */

const LEAD_STATUSES = ["nuevo", "contactado", "cerrado"] as const;

export async function setLeadStatusAction(formData: FormData): Promise<void> {
  const ctx = await ownerContext();
  if (!ctx) redirect("/mi-sitio/login");
  const leadId = Number(formData.get("leadId"));
  const status = String(formData.get("status"));
  if (!Number.isInteger(leadId) || !(LEAD_STATUSES as readonly string[]).includes(status)) return;
  await db
    .update(siteLeads)
    .set({ status: status as (typeof LEAD_STATUSES)[number] })
    .where(and(eq(siteLeads.id, leadId), eq(siteLeads.businessId, ctx.business.id)));
  revalidatePath("/mi-sitio");
}

export type SiteOptionsState = { ok?: string; error?: string; fieldErrors?: Record<string, string> };

export async function saveSiteOptionsAction(_prev: SiteOptionsState, formData: FormData): Promise<SiteOptionsState> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "No pudimos identificar tu negocio. Entrá de nuevo." };

  const reviewUrl = String(formData.get("googleReviewUrl") ?? "").trim();
  if (reviewUrl !== "" && (reviewUrl.length > 300 || !isGoogleReviewUrl(reviewUrl))) {
    return {
      error: "Revisá el enlace de reseñas.",
      fieldErrors: { googleReviewUrl: "Pegá el enlace que te da Google para pedir reseñas (empieza con https://g.page o https://search.google.com)." },
    };
  }

  const options = {
    leadForm: formData.get("leadForm") === "on",
    reviewButton: formData.get("reviewButton") === "on",
    credit: formData.get("credit") === "on",
  };
  // Krediten länkar till /registro?ref=<kod> — koden måste finnas innan sajten renderas.
  if (options.credit) await ensureReferralCode(ctx.business.id);

  await db
    .update(businesses)
    .set({ siteOptionsJson: options, googleReviewUrl: reviewUrl || null })
    .where(eq(businesses.id, ctx.business.id));

  await logActivity({ actorUserId: ctx.userId, businessId: ctx.business.id, action: "owner_site_options", meta: { ...options, reviewUrl: Boolean(reviewUrl) } });

  revalidateTag(`biz:${ctx.business.slug}`);
  revalidatePath("/mi-sitio");
  return { ok: "Guardado. Tu página ya muestra los cambios." };
}

/**
 * "Me interesa": en rad i din säljkö (/admin/leads), VenderCRM om det är
 * påslaget, och sedan rakt in i WhatsApp med dig — med texten förifylld.
 * Samma tjänst två gånger medan en förfrågan är öppen blir inte en ny rad.
 */
export async function requestServiceAction(formData: FormData): Promise<void> {
  const ctx = await ownerContext();
  if (!ctx) redirect("/mi-sitio/login");

  const key = String(formData.get("serviceKey") ?? "");
  const catalog = await getUpsellCatalog();
  const service =
    key === PLAN_UPGRADE_KEY
      ? { key, title: "Pasarme al plan Plus" }
      : catalog.find((s) => s.key === key && s.enabled);
  if (!service) redirect("/mi-sitio#crecer");

  const [open] = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.businessId, ctx.business.id),
        eq(serviceRequests.serviceKey, service.key),
        inArray(serviceRequests.status, ["nuevo", "contactado"]),
      ),
    )
    .limit(1);

  if (!open) {
    await db.insert(serviceRequests).values({ businessId: ctx.business.id, serviceKey: service.key, serviceTitle: service.title });
    await logActivity({ actorUserId: ctx.userId, businessId: ctx.business.id, action: "servicio_interes", meta: { key: service.key } });

    const crm = venderCrmConfig();
    if (crm) {
      await pushLead(crm, {
        phone: ctx.business.whatsappPhone,
        idempotency_key: createHash("sha256").update(`sitio-servicio|${ctx.business.id}|${service.key}|${new Date().toISOString().slice(0, 10)}`).digest("hex").slice(0, 40),
        name: ctx.business.name.slice(0, 200),
        message: `Cliente de sitio.com.py interesado en: ${service.title}.`,
        source: "sitio:servicio",
        page_url: absoluteUrl(`/${ctx.business.slug}`),
        fields: { business_id: ctx.business.id, servicio: service.key },
      });
    }
    revalidatePath("/admin/leads");
  }

  revalidatePath("/mi-sitio");
  const sales = env.salesWhatsapp ? normalizePyPhone(env.salesWhatsapp) : null;
  if (sales) redirect(waLink(sales, serviceInterestMessage(ctx.business.name, service.title)));
  redirect("/mi-sitio?pedido=1#crecer");
}
