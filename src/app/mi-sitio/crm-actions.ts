"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { siteLeads } from "@/db/schema";
import { findRefClick, getLeadFor, refCodeAlreadyRegistered } from "@/db/crm-queries";
import { logActivity } from "@/lib/auth";
import { toDayString } from "@/lib/billing";
import { addCustomerSchema, canTransition, crmReplyMessage, fieldErrorsOf, leadIdSchema, refCustomerSchema, statusAfterReply, updateLeadSchema } from "@/lib/crm";
import { waLink } from "@/lib/format";
import { classifyLeadSource } from "@/lib/lead-source";
import { ownerContext } from "@/lib/owner-context";

/**
 * Owner-mutationerna för CRM:et (crm-1). Tenant kommer alltid ur sessionen via
 * ownerContext() — aldrig ur formuläret. Superadmin får null där och kan alltså
 * inte skriva (vyn är skrivskyddad, som /mi-sitio?sitio=).
 */

export type CrmFormState = { ok?: string; error?: string; fieldErrors?: Record<string, string> };

const NO_CONTEXT = "No pudimos identificar tu negocio. Entrá de nuevo.";
const CLIENTES = "/mi-sitio/clientes";

function dayToDate(day: string | null): Date | null {
  return day ? new Date(`${day}T00:00:00Z`) : null;
}

function raw(formData: FormData, ...names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, String(formData.get(n) ?? "")]));
}

/** "Agregar cliente": en lead för någon ägaren redan känner. */
export async function addCustomerAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const ctx = await ownerContext();
  if (!ctx) return { error: NO_CONTEXT };

  const parsed = addCustomerSchema.safeParse(raw(formData, "name", "phone", "note", "followUpDay"));
  if (!parsed.success) return { error: "Revisá los datos.", fieldErrors: fieldErrorsOf(parsed.error) };
  const d = parsed.data;

  await db.insert(siteLeads).values({
    businessId: ctx.business.id,
    kind: "manual",
    name: d.name,
    phone: d.phone,
    notes: d.note,
    followUpDay: dayToDate(d.followUpDay),
    // Ägaren har redan kontakt med personen — den hör inte hemma bland "Nuevas".
    status: "contactado",
    contactedAt: new Date(),
    source: null,
  });

  await logActivity({ actorUserId: ctx.userId, businessId: ctx.business.id, action: "crm_cliente_agregado" });
  revalidatePath(CLIENTES);
  revalidatePath("/mi-sitio");
  return { ok: `Listo, agregamos a ${d.name}.` };
}

/**
 * "Registrar chat por código": en WhatsApp-chatt som började med "ref K7Q2" blir
 * en lead med källa och sida ur klicket. Hittas ingen klick sparas den ändå,
 * utan ursprung — ägaren får veta det.
 */
export async function registerRefCustomerAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const ctx = await ownerContext();
  if (!ctx) return { error: NO_CONTEXT };

  const parsed = refCustomerSchema.safeParse(raw(formData, "code", "name", "phone"));
  if (!parsed.success) return { error: "Revisá los datos.", fieldErrors: fieldErrorsOf(parsed.error) };
  const d = parsed.data;

  const click = await findRefClick(ctx.business.id, d.code);
  if (click && (await refCodeAlreadyRegistered(ctx.business.id, d.code))) {
    return { error: "Ese código ya está registrado.", fieldErrors: { code: "Ya lo cargaste antes. Buscalo en tu lista." } };
  }

  await db.insert(siteLeads).values({
    businessId: ctx.business.id,
    kind: "whatsapp",
    name: d.name,
    phone: d.phone,
    status: "contactado",
    contactedAt: new Date(),
    refCode: click ? d.code : null,
    sourcePath: click?.path ? click.path.slice(0, 120) : null,
    source: click ? classifyLeadSource(click.referrerHost) : null,
  });

  await logActivity({ actorUserId: ctx.userId, businessId: ctx.business.id, action: "crm_chat_registrado", meta: { found: Boolean(click) } });
  revalidatePath(CLIENTES);
  revalidatePath("/mi-sitio");
  return {
    ok: click
      ? `Listo. ${d.name} quedó registrado con su origen.`
      : `No encontramos ese código en los últimos 60 días, así que guardamos a ${d.name} sin origen. Revisá que esté bien escrito.`,
  };
}

/** Estado, notas, seguimiento y valor de una lead. */
export async function updateLeadAction(_prev: CrmFormState, formData: FormData): Promise<CrmFormState> {
  const ctx = await ownerContext();
  if (!ctx) return { error: NO_CONTEXT };

  const parsed = updateLeadSchema.safeParse(raw(formData, "leadId", "status", "notes", "followUpDay", "valueGs"));
  if (!parsed.success) return { error: "Revisá los datos.", fieldErrors: fieldErrorsOf(parsed.error) };
  const d = parsed.data;

  const lead = await getLeadFor(ctx.business.id, d.leadId);
  if (!lead) return { error: "No encontramos ese cliente." };
  if (!canTransition(lead.status, d.status)) return { error: "Ese estado ya no se puede elegir.", fieldErrors: { status: "Elegí otro estado." } };

  const leavesNew = lead.status === "nuevo" && (d.status === "contactado" || d.status === "cliente");
  await db
    .update(siteLeads)
    .set({
      status: d.status,
      notes: d.notes,
      followUpDay: dayToDate(d.followUpDay),
      valueGs: d.valueGs,
      ...(leavesNew && !lead.contactedAt ? { contactedAt: new Date() } : {}),
    })
    .where(and(eq(siteLeads.id, lead.id), eq(siteLeads.businessId, ctx.business.id)));

  revalidatePath(CLIENTES);
  revalidatePath("/mi-sitio");
  return { ok: "Guardado." };
}

/**
 * "Responder por WhatsApp": en ny lead blir "Respondida" (med tidpunkt) och
 * ägaren skickas rakt till wa.me med texten förifylld — samma mönster som
 * requestServiceAction.
 */
export async function replyWhatsappAction(formData: FormData): Promise<void> {
  const ctx = await ownerContext();
  if (!ctx) redirect("/mi-sitio/login");

  const parsed = leadIdSchema.safeParse(raw(formData, "leadId"));
  if (!parsed.success) redirect(CLIENTES);
  const lead = await getLeadFor(ctx.business.id, parsed.data.leadId);
  if (!lead) redirect(CLIENTES);

  const next = statusAfterReply(lead.status);
  if (next) {
    await db
      .update(siteLeads)
      .set({ status: next, contactedAt: new Date() })
      .where(and(eq(siteLeads.id, lead.id), eq(siteLeads.businessId, ctx.business.id)));
    revalidatePath(CLIENTES);
    revalidatePath("/mi-sitio");
  }

  redirect(
    waLink(
      lead.phone,
      crmReplyMessage(
        {
          name: lead.name,
          kind: lead.kind,
          serviceName: lead.serviceName,
          requestedDay: lead.requestedDay ? toDayString(lead.requestedDay) : null,
          requestedTime: lead.requestedTime,
        },
        ctx.business.name,
      ),
    ),
  );
}
