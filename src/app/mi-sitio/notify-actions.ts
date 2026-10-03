"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { ownerContext } from "@/lib/owner-context";
import { sendTestPush } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

export type NotifyState = { error?: string; ok?: string };

const emailSchema = z.union([z.literal(""), z.string().trim().toLowerCase().email().max(190)]);

/** Mejlet för nya consultas. Tomt fält rensar det. Tenant ur sessionen. */
export async function saveNotifyEmailAction(_prev: NotifyState, formData: FormData): Promise<NotifyState> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "No pudimos identificar tu negocio. Entrá de nuevo." };

  const parsed = emailSchema.safeParse(String(formData.get("notifyEmail") ?? "").trim());
  if (!parsed.success) return { error: "Ese email no parece válido." };

  await db
    .update(businesses)
    .set({ notifyEmail: parsed.data === "" ? null : parsed.data })
    .where(eq(businesses.id, ctx.business.id));
  revalidatePath("/mi-sitio");
  return { ok: parsed.data === "" ? "Listo, ya no te escribimos por email." : "Listo, te avisamos a ese email." };
}

/** Testknappen: ett aviso till ägarens egna telefoner. */
export async function sendTestPushAction(): Promise<NotifyState> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "No pudimos identificar tu negocio. Entrá de nuevo." };
  if (!rateLimit(`push-test:${ctx.business.id}`, 5, 10 * 60_000).ok) {
    return { error: "Probaste varias veces seguidas. Esperá unos minutos." };
  }
  const res = await sendTestPush(ctx.business.id);
  if (!res.configured) return { error: "Los avisos todavía no están habilitados en el servidor." };
  if (res.sent === 0) return { error: "No llegó a ningún teléfono. Probá desactivar y activar de nuevo." };
  return { ok: `Enviado a ${res.sent} ${res.sent === 1 ? "teléfono" : "teléfonos"}.` };
}
