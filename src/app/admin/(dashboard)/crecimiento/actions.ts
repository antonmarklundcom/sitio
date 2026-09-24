"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { saveGrowthSettings, saveUpsellCatalog } from "@/db/growth-queries";
import { logActivity, requireRole } from "@/lib/auth";
import { growthSettingsSchema, upsellServiceSchema, type UpsellService } from "@/lib/growth";

function back(msg: string, key: "ok" | "error" = "ok"): never {
  redirect(`/admin/crecimiento?${key}=${encodeURIComponent(msg)}`);
}

export async function saveGrowthSettingsAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const parsed = growthSettingsSchema.safeParse({
    referralRewardDays: Number(formData.get("referralRewardDays")),
    referredBonusDays: Number(formData.get("referredBonusDays")),
    partnerCommissionPct: Number(formData.get("partnerCommissionPct")),
    autoPublish: formData.get("autoPublish") === "on",
  });
  if (!parsed.success) back("Revisá los números: días 0–365, comisión 0–100.", "error");
  await saveGrowthSettings(parsed.data);
  await logActivity({ actorUserId: user.userId, action: "crecimiento_ajustes", meta: parsed.data });
  revalidatePath("/admin/crecimiento");
  revalidatePath("/mi-sitio");
  back("Ajustes guardados.");
}

/** Katalogen skrivs som helhet: raderna i formuläret är hela listan. Tom rubrik = raden tas bort. */
export async function saveUpsellCatalogAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const rows = Number(formData.get("rows"));
  const out: UpsellService[] = [];
  for (let i = 0; i < Math.min(rows, 12); i++) {
    const title = String(formData.get(`title.${i}`) ?? "").trim();
    if (!title) continue;
    const parsed = upsellServiceSchema.safeParse({
      key: String(formData.get(`key.${i}`) ?? "").trim().toLowerCase(),
      title,
      body: String(formData.get(`body.${i}`) ?? ""),
      price: String(formData.get(`price.${i}`) ?? ""),
      enabled: formData.get(`enabled.${i}`) === "on",
    });
    if (!parsed.success) back(`Fila ${i + 1}: ${parsed.error.issues[0]?.message ?? "revisá los campos"}`, "error");
    if (out.some((s) => s.key === parsed.data.key)) back(`La clave “${parsed.data.key}” está repetida.`, "error");
    out.push(parsed.data);
  }
  await saveUpsellCatalog(out);
  await logActivity({ actorUserId: user.userId, action: "crecimiento_catalogo", meta: { keys: out.map((s) => s.key) } });
  revalidatePath("/admin/crecimiento");
  revalidatePath("/mi-sitio");
  back("Catálogo guardado. Tus clientes ya lo ven en su panel.");
}

export async function markReviewedAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const id = Number(formData.get("businessId"));
  if (!Number.isInteger(id)) return;
  await db.update(businesses).set({ needsReview: false }).where(eq(businesses.id, id));
  await logActivity({ actorUserId: user.userId, businessId: id, action: "autopublicado_revisado" });
  revalidatePath("/admin/crecimiento");
}
