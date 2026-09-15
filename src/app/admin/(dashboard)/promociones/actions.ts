"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { promoSettingsSchema, savePromoSettings } from "@/lib/settings";

export async function savePromoAction(formData: FormData) {
  await requireRole("superadmin");
  const parsed = promoSettingsSchema.safeParse({
    trialEnabled: formData.has("trialEnabled") ? formData.get("trialEnabled") === "on" ? true : formData.get("trialEnabled") : false,
    trialDays: Number(formData.get("trialDays")),
    trialPlan: formData.get("trialPlan"),
    bannerText: formData.get("bannerText"),
  });
  if (!parsed.success) {
    const query = new URLSearchParams();
    for (const issue of parsed.error.issues) query.set(String(issue.path[0]), issue.message);
    redirect("/admin/promociones?" + query.toString());
  }
  await savePromoSettings(parsed.data);
  revalidatePath("/");
  revalidatePath("/registro");
  revalidatePath("/admin/promociones");
  redirect("/admin/promociones?ok=1");
}
