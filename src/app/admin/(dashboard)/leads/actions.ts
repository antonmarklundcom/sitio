"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, serviceRequests } from "@/db/schema";
import { logActivity, requireRole } from "@/lib/auth";
import { LEAD_STAGES, type LeadStage } from "@/lib/radar";

function isLeadStage(v: string): v is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(v);
}

/**
 * Fri riktning (plan §6.3): en superadmin kan flytta en rad till vilket
 * stadium som helst, inte bara framåt — ett felklick ska rättas med ett nytt
 * klick, inte en databasändring.
 */
export async function setLeadStageAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const businessId = Number(formData.get("businessId"));
  const stage = String(formData.get("stage") ?? "");
  if (!businessId || !isLeadStage(stage)) throw new Error("Etapa o sitio no válidos.");

  const [business] = await db
    .select({ id: businesses.id, leadStage: businesses.leadStage })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!business) throw new Error("El sitio no existe.");

  if (business.leadStage !== stage) {
    await db.update(businesses).set({ leadStage: stage }).where(eq(businesses.id, businessId));
    await logActivity({
      actorUserId: user.userId,
      businessId,
      action: "lead_stage_changed",
      meta: { from: business.leadStage, to: stage },
    });
  }

  revalidatePath("/admin/leads");
  redirect("/admin/leads");
}

export async function saveLeadNoteAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const businessId = Number(formData.get("businessId"));
  if (!businessId) throw new Error("Sitio no válido.");

  const notes = String(formData.get("adminNotes") ?? "")
    .trim()
    .slice(0, 2000);

  await db
    .update(businesses)
    .set({ adminNotes: notes || null })
    .where(eq(businesses.id, businessId));
  await logActivity({
    actorUserId: user.userId,
    businessId,
    action: "lead_note_saved",
    meta: { length: notes.length },
  });

  revalidatePath("/admin/leads");
  redirect("/admin/leads");
}

/** "Me interesa" från owner-panelen (growth-1): flytta förfrågan i säljkön. */
export async function setServiceRequestStatusAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const id = Number(formData.get("requestId"));
  const status = String(formData.get("status"));
  const allowed = ["nuevo", "contactado", "vendido", "descartado"] as const;
  if (!Number.isInteger(id) || !(allowed as readonly string[]).includes(status)) return;
  await db.update(serviceRequests).set({ status: status as (typeof allowed)[number] }).where(eq(serviceRequests.id, id));
  await logActivity({ actorUserId: user.userId, action: "servicio_estado", meta: { requestId: id, status } });
  revalidatePath("/admin/leads");
}
