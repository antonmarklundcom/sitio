"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessModules } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { logActivity, requireRole } from "@/lib/auth";
import { moduleKeySchema } from "@/lib/modules";

/**
 * Slår på eller av en modul för en kund. Superadmin-only: modulerna är
 * upsellen, och en owner som kunde slå på sina egna hade fått gratis det du
 * säljer.
 *
 * Priset ligger utanför systemet (PLAN.md D10: helår vid aktivering), så
 * `enabledAt` sätts om vid varje ny påslagning — det är datumet du fakturerar
 * ifrån. Vid avstängning lämnas det kvar: att veta när modulen senast var
 * aktiv är mer värt än ett tomt fält.
 */
export async function toggleModuleAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");

  const businessId = Number(formData.get("businessId"));
  const parsed = moduleKeySchema.safeParse(formData.get("moduleKey"));
  if (!Number.isInteger(businessId) || !parsed.success) return;
  const moduleKey = parsed.data;
  const enable = formData.get("enabled") === "1";

  const business = await getBusinessById(businessId);
  if (!business) return;

  const [existing] = await db
    .select({ id: businessModules.id, isEnabled: businessModules.isEnabled })
    .from(businessModules)
    .where(and(eq(businessModules.businessId, businessId), eq(businessModules.moduleKey, moduleKey)))
    .limit(1);

  if (existing?.isEnabled === enable) return;

  if (existing) {
    await db
      .update(businessModules)
      .set({ isEnabled: enable, ...(enable ? { enabledAt: new Date() } : {}) })
      .where(eq(businessModules.id, existing.id));
  } else {
    await db.insert(businessModules).values({
      businessId,
      moduleKey,
      isEnabled: enable,
      enabledAt: enable ? new Date() : null,
    });
  }

  await logActivity({
    actorUserId: user.userId,
    businessId,
    action: enable ? "module_enabled" : "module_disabled",
    meta: { moduleKey },
  });

  // Temana renderar villkorat mot modulerna, så den publika sajten är fel
  // tills ISR-cachen slängs.
  revalidateTag(`biz:${business.slug}`);
  revalidatePath(`/admin/sitios/${businessId}`);
  revalidatePath("/mi-sitio");
}
