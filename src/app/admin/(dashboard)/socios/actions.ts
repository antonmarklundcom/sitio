"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { businesses, partnerCommissions, partners } from "@/db/schema";
import { getGrowthSettings, newPartnerCode, newPartnerToken } from "@/db/growth-queries";
import { logActivity, requireRole } from "@/lib/auth";
import { normalizePyPhone } from "@/lib/format";

/** Säljare på provision (growth-1, idé 7). Spanska — adminet följer resten. */

function back(msg: string, key: "ok" | "error" = "ok"): never {
  redirect(`/admin/socios?${key}=${encodeURIComponent(msg)}`);
}

const partnerSchema = z.object({
  name: z.string().trim().min(2, "Escribí el nombre.").max(120),
  phone: z.string().trim().max(30).optional().default(""),
  commissionPct: z.coerce.number().int().min(0).max(100),
  notes: z.string().trim().max(300).optional().default(""),
});

export async function createPartnerAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const settings = await getGrowthSettings();
  const parsed = partnerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    commissionPct: formData.get("commissionPct") || settings.partnerCommissionPct,
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Revisá el formulario.", "error");
  const phone = parsed.data.phone ? normalizePyPhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) back("El teléfono no es un número paraguayo válido.", "error");

  const code = await newPartnerCode(parsed.data.name);
  const [res] = await db.insert(partners).values({
    name: parsed.data.name,
    phone,
    code,
    commissionPct: parsed.data.commissionPct,
    token: newPartnerToken(),
    notes: parsed.data.notes || null,
  });
  await logActivity({ actorUserId: user.userId, action: "socio_creado", meta: { partnerId: Number(res.insertId), code } });
  revalidatePath("/admin/socios");
  back(`Socio creado con el código ${code}.`);
}

export async function updatePartnerAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const id = Number(formData.get("partnerId"));
  const pct = Number(formData.get("commissionPct"));
  const status = formData.get("status") === "disabled" ? "disabled" : "active";
  if (!Number.isInteger(id) || !Number.isInteger(pct) || pct < 0 || pct > 100) back("Datos inválidos.", "error");
  await db.update(partners).set({ commissionPct: pct, status }).where(eq(partners.id, id));
  await logActivity({ actorUserId: user.userId, action: "socio_actualizado", meta: { partnerId: id, pct, status } });
  revalidatePath("/admin/socios");
  back("Socio actualizado.");
}

/** Koppla en befintlig sajt till en säljare (du skapade altan åt säljarens kund). */
export async function assignBusinessAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const partnerId = Number(formData.get("partnerId"));
  const businessId = Number(formData.get("businessId"));
  if (!Number.isInteger(partnerId) || !Number.isInteger(businessId)) back("Elegí socio y sitio.", "error");
  const [p] = await db.select({ id: partners.id }).from(partners).where(eq(partners.id, partnerId)).limit(1);
  if (!p) back("El socio no existe.", "error");
  // En sajt har en källa: säljare ersätter kund-värvning.
  await db.update(businesses).set({ partnerId, referredByBusinessId: null }).where(eq(businesses.id, businessId));
  await logActivity({ actorUserId: user.userId, businessId, action: "socio_asignado", meta: { partnerId } });
  revalidatePath("/admin/socios");
  back("Sitio asignado al socio. Las comisiones se generan al confirmar pagos.");
}

export async function markCommissionPaidAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const id = Number(formData.get("commissionId"));
  const to = formData.get("to") === "void" ? "void" : "paid";
  const [res] = await db
    .update(partnerCommissions)
    .set({ status: to, paidAt: to === "paid" ? new Date() : null })
    .where(and(eq(partnerCommissions.id, id), eq(partnerCommissions.status, "pending")));
  if (res.affectedRows) await logActivity({ actorUserId: user.userId, action: `comision_${to}`, meta: { commissionId: id } });
  revalidatePath("/admin/socios");
  back(to === "paid" ? "Comisión marcada como pagada." : "Comisión anulada.");
}
