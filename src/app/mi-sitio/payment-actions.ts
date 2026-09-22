"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { getCurrentSubscription } from "@/db/billing-queries";
import { logActivity } from "@/lib/auth";
import { ownerContext } from "@/lib/owner-context";
import { ownerPaymentReportSchema, ownerReportPeriod } from "@/lib/billing";
import { storeReceipt } from "@/lib/receipt";

export type PaymentReportState = { error?: string; ok?: string };

/**
 * Kunden rapporterar en betalning själv (R3-21, PR-19b): metod, referens,
 * kvitto ⇒ en payment med status `reported`. Inget förlängs här — det gör
 * superadmin med "Confirmar" i /admin/pagos när pengarna syns på kontot.
 *
 * Tenanten kommer ur sessionen (ownerContext), perioden räknas ut på servern
 * (ownerReportPeriod) och en rapport i taget: en andra medan den första
 * väntar hade bara blivit en dubblett att avvisa.
 */
export async function reportPaymentAction(
  _prev: PaymentReportState,
  formData: FormData,
): Promise<PaymentReportState> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "No pudimos guardar. Entrá de nuevo." };
  const businessId = ctx.business.id;

  const subscription = await getCurrentSubscription(businessId);
  if (!subscription || subscription.status === "canceled") {
    return { error: "Tu sitio no tiene un plan activo. Escribinos por WhatsApp y lo vemos." };
  }

  const [pending] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.businessId, businessId), eq(payments.status, "reported")))
    .limit(1);
  if (pending) return { error: "Ya tenemos un pago tuyo para revisar. Te avisamos cuando lo confirmemos." };

  const parsed = ownerPaymentReportSchema.safeParse({
    amountGs: formData.get("amountGs") ?? "",
    method: formData.get("method") ?? "",
    reference: formData.get("reference") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos del pago." };
  const values = parsed.data;

  const receipt = await storeReceipt(
    businessId,
    formData.get("receipt"),
    `Comprobante informado por el cliente ${values.reference ?? ""}`.trim(),
  );
  if ("error" in receipt) {
    if (receipt.error === "size") return { error: "El comprobante pesa más de 10 MB." };
    if (receipt.error === "mime") return { error: "Ese formato no anda. Mandá una foto JPEG, PNG, WEBP o HEIC." };
    return { error: "No pudimos leer la foto del comprobante. ¿Probás con otra?" };
  }

  // Sin número de operación ni comprobante no hay nada que buscar en la
  // cuenta — salvo efectivo, que se entrega en mano.
  if (!values.reference && receipt.mediaId === null && values.method !== "efectivo") {
    return { error: "Poné el número de operación o subí una foto del comprobante." };
  }

  const period = ownerReportPeriod(subscription);
  await db.insert(payments).values({
    businessId,
    subscriptionId: subscription.id,
    amountGs: values.amountGs,
    method: values.method,
    reference: values.reference || null,
    receiptMediaId: receipt.mediaId,
    periodStart: new Date(`${period.periodStart}T00:00:00Z`),
    periodEnd: new Date(`${period.periodEnd}T00:00:00Z`),
    status: "reported",
    notes: "Informado por el cliente desde /mi-sitio.",
  });

  await logActivity({
    actorUserId: ctx.userId,
    businessId,
    action: "owner_payment_reported",
    meta: { amountGs: values.amountGs, method: values.method, reference: values.reference || null, ...period },
  });

  revalidatePath("/mi-sitio");
  revalidatePath("/admin/pagos");
  revalidatePath(`/admin/sitios/${businessId}`);
  revalidatePath("/admin");
  return { ok: "¡Gracias! Recibimos tu pago. Lo confirmamos apenas veamos el dinero en la cuenta." };
}
