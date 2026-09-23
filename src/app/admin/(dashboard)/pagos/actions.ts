"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, businesses, payments, subscriptions } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { getCurrentSubscription } from "@/db/billing-queries";
import { logActivity, requireRole } from "@/lib/auth";
import { storeReceipt } from "@/lib/receipt";
import { paymentFormSchema, subscriptionFormSchema, toDayString } from "@/lib/billing";
import { extendedExpiry, runBillingLifecycle } from "@/lib/billing-lifecycle";

export type BillingFormState = { error?: string; fieldErrors?: Record<string, string>; ok?: string };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) out[issue.path.map(String).join(".") || "_"] ??= issue.message;
  return out;
}

function refresh(businessId: number) {
  revalidatePath(`/admin/sitios/${businessId}`);
  revalidatePath("/admin/pagos");
  revalidatePath("/admin");
}

/**
 * Skapa eller ersätt prenumerationen för en sajt. Superadmin sätter plan,
 * pris och period själv — priset förhandlas per kund och får aldrig låsas till
 * en pristabell i koden.
 */
export async function saveSubscriptionAction(
  businessId: number,
  _prev: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const user = await requireRole("superadmin");

  const business = await getBusinessById(businessId);
  if (!business) return { error: "El sitio no existe." };

  const parsed = subscriptionFormSchema.safeParse({
    plan: formData.get("plan") ?? "basico",
    priceGs: formData.get("priceGs") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    expiresAt: formData.get("expiresAt") ?? "",
    status: formData.get("status") ?? "active",
  });
  if (!parsed.success) {
    return { error: "El formulario contiene errores.", fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const values = parsed.data;
  if (values.expiresAt <= values.startsAt) {
    return { error: "El período no es válido.", fieldErrors: { expiresAt: "La fecha de fin debe ser posterior a la fecha de inicio." } };
  }

  const existingId = Number(formData.get("subscriptionId") ?? 0);
  const row = {
    plan: values.plan,
    priceGs: values.priceGs,
    startsAt: new Date(`${values.startsAt}T00:00:00Z`),
    expiresAt: new Date(`${values.expiresAt}T00:00:00Z`),
    status: values.status,
  };

  if (existingId > 0) {
    const current = await getCurrentSubscription(businessId);
    // Tenant-check: id:t kommer från ett formulär och får aldrig litas på.
    if (!current || current.id !== existingId) return { error: "La suscripción no pertenece a este sitio." };
    await db.update(subscriptions).set(row).where(eq(subscriptions.id, existingId));
  } else {
    await db.insert(subscriptions).values({ businessId, ...row });
  }

  await logActivity({
    actorUserId: user.userId,
    businessId,
    action: existingId > 0 ? "subscription_updated" : "subscription_created",
    meta: { plan: values.plan, priceGs: values.priceGs, expiresAt: values.expiresAt, status: values.status },
  });

  refresh(businessId);
  return { ok: "Suscripción guardada." };
}

/**
 * Registrera en betalning. Status `reported` — bekräftelsen är ett eget steg,
 * så att ett slarvigt formulär aldrig kan förlänga en prenumeration av misstag.
 * Kvittobilden går genom samma pipeline som allt annat: EXIF strippas.
 */
export async function registerPaymentAction(
  businessId: number,
  _prev: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const user = await requireRole("superadmin");

  const business = await getBusinessById(businessId);
  if (!business) return { error: "El sitio no existe." };

  const subscription = await getCurrentSubscription(businessId);
  if (!subscription) return { error: "Creá una suscripción primero — un pago siempre corresponde a un período." };

  const parsed = paymentFormSchema.safeParse({
    amountGs: formData.get("amountGs") ?? "",
    method: formData.get("method") ?? "transferencia",
    reference: formData.get("reference") ?? "",
    periodStart: formData.get("periodStart") ?? "",
    periodEnd: formData.get("periodEnd") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: "El formulario contiene errores.", fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const values = parsed.data;
  if (values.periodEnd <= values.periodStart) {
    return { error: "El período no es válido.", fieldErrors: { periodEnd: "La fecha de fin debe ser posterior a la fecha de inicio." } };
  }

  const receipt = await storeReceipt(
    businessId,
    formData.get("receipt"),
    `Comprobante ${values.reference || toDayString(new Date())}`,
  );
  if ("error" in receipt) {
    if (receipt.error === "size") {
      return { error: "El comprobante supera los 10 MB.", fieldErrors: { receipt: "Máximo 10 MB." } };
    }
    if (receipt.error === "mime") {
      return { error: "El formato no es compatible.", fieldErrors: { receipt: "Usá JPEG, PNG, WEBP o HEIC." } };
    }
    return { error: "No se pudo leer la imagen del comprobante.", fieldErrors: { receipt: "¿El archivo está dañado?" } };
  }
  const receiptMediaId = receipt.mediaId;

  await db.insert(payments).values({
    businessId,
    subscriptionId: subscription.id,
    amountGs: values.amountGs,
    method: values.method,
    reference: values.reference || null,
    receiptMediaId,
    periodStart: new Date(`${values.periodStart}T00:00:00Z`),
    periodEnd: new Date(`${values.periodEnd}T00:00:00Z`),
    status: "reported",
    notes: values.notes || null,
  });

  await logActivity({
    actorUserId: user.userId,
    businessId,
    action: "payment_reported",
    meta: { amountGs: values.amountGs, method: values.method, reference: values.reference || null },
  });

  refresh(businessId);
  return { ok: "El pago está registrado. Confirmalo cuando veas el dinero acreditado." };
}

async function loadPayment(paymentId: number) {
  const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  return rows[0] ?? null;
}

/** Senaste pausen kom från livscykeln (status_paused med reason subscription_expired). */
async function pausedForNonPayment(businessId: number): Promise<boolean> {
  const [last] = await db
    .select({ meta: activityLog.metaJson })
    .from(activityLog)
    .where(and(eq(activityLog.businessId, businessId), eq(activityLog.action, "status_paused")))
    .orderBy(desc(activityLog.id))
    .limit(1);
  const meta = last?.meta as { reason?: string } | null | undefined;
  return meta?.reason === "subscription_expired";
}

/**
 * Bekräfta betalning: förlänger prenumerationen till betalningens periodslut
 * och sätter den till `active`. En pausad sajt som pausades av utebliven
 * betalning publiceras igen.
 */
export async function confirmPaymentAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const paymentId = Number(formData.get("paymentId"));
  const back = String(formData.get("back") ?? "/admin/pagos");

  const payment = await loadPayment(paymentId);
  if (!payment) throw new Error("El pago no existe.");
  if (payment.status === "confirmed") redirect(back);

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, payment.subscriptionId))
    .limit(1);
  if (!subscription) throw new Error("La suscripción no existe.");

  const nextExpiry = extendedExpiry(subscription.expiresAt, payment.periodEnd);

  await db
    .update(payments)
    .set({ status: "confirmed", confirmedByUserId: user.userId, confirmedAt: new Date() })
    .where(eq(payments.id, paymentId));

  await db
    .update(subscriptions)
    .set({ status: "active", expiresAt: nextExpiry })
    .where(eq(subscriptions.id, subscription.id));

  const [business] = await db
    .select({ id: businesses.id, slug: businesses.slug, status: businesses.status })
    .from(businesses)
    .where(eq(businesses.id, payment.businessId))
    .limit(1);

  // Betalt igen ⇒ sajten upp. Bara om den pausades för utebliven betalning
  // (R3-36): en sajt du pausat för hand — klagomål, kundens egen begäran —
  // ska inte tyst publiceras av en betalning. Ett utkast rörs aldrig.
  const reactivate = business?.status === "paused" && (await pausedForNonPayment(business.id));
  if (business && reactivate) {
    await db.update(businesses).set({ status: "published" }).where(eq(businesses.id, business.id));
    revalidateTag(`biz:${business.slug}`);
    revalidatePath("/sitemap.xml");
  }

  await logActivity({
    actorUserId: user.userId,
    businessId: payment.businessId,
    action: "payment_confirmed",
    meta: {
      paymentId,
      amountGs: payment.amountGs,
      expiresAt: toDayString(nextExpiry),
      reactivated: reactivate,
    },
  });

  refresh(payment.businessId);
  redirect(`${back}?ok=${encodeURIComponent("El pago está confirmado.")}`);
}

export async function rejectPaymentAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const paymentId = Number(formData.get("paymentId"));
  const back = String(formData.get("back") ?? "/admin/pagos");

  const payment = await loadPayment(paymentId);
  if (!payment) throw new Error("El pago no existe.");

  await db.update(payments).set({ status: "rejected" }).where(eq(payments.id, paymentId));
  await logActivity({
    actorUserId: user.userId,
    businessId: payment.businessId,
    action: "payment_rejected",
    meta: { paymentId, amountGs: payment.amountGs },
  });

  refresh(payment.businessId);
  redirect(`${back}?ok=${encodeURIComponent("El pago está rechazado.")}`);
}

/**
 * Kör livscykelsteget manuellt. Finns för att cron-jobbet i hPanel kan saknas
 * eller ha slutat svara — och för att du ska kunna se effekten direkt i stället
 * för att undra om den kördes i natt.
 */
export async function runLifecycleAction(): Promise<void> {
  const user = await requireRole("superadmin");
  const result = await runBillingLifecycle(user.userId);

  for (const slug of result.pausedBusinesses) revalidateTag(`biz:${slug}`);
  if (result.pausedBusinesses.length > 0) revalidatePath("/sitemap.xml");

  revalidatePath("/admin/pagos");
  revalidatePath("/admin");

  const summary = `Período de gracia: ${result.toGrace}. Vencidas: ${result.toExpired}. Sitios en pausa: ${result.pausedBusinesses.length}.`;
  redirect(`/admin/pagos?ok=${encodeURIComponent(summary)}`);
}
