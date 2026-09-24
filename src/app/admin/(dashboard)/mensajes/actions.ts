"use server";

import { revalidatePath } from "next/cache";
import { listMessageQueue, recordMessageSent } from "@/db/growth-queries";
import { logActivity, requireRole } from "@/lib/auth";

/**
 * Markerar ett köat meddelande som skickat (growth-1). Raden måste finnas i
 * dagens kö — ett handskrivet formulär kan inte markera något annat.
 */
export async function markMessageSentAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const businessId = Number(formData.get("businessId"));
  const kind = String(formData.get("kind") ?? "");
  const periodKey = String(formData.get("periodKey") ?? "");
  const skipped = formData.get("skip") === "1";

  const item = (await listMessageQueue()).find(
    (q) => q.businessId === businessId && q.kind === kind && q.periodKey === periodKey,
  );
  if (!item) return;

  await recordMessageSent({ businessId, kind, periodKey, actorUserId: user.userId });
  await logActivity({ actorUserId: user.userId, businessId, action: skipped ? "mensaje_omitido" : "mensaje_enviado", meta: { kind, periodKey } });
  revalidatePath("/admin/mensajes");
}
