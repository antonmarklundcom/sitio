"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, media, payments, subscriptions } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { getCurrentSubscription } from "@/db/billing-queries";
import { logActivity, requireRole } from "@/lib/auth";
import { processImage } from "@/lib/media";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from "@/lib/media-shared";
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
  if (!business) return { error: "Sajten finns inte." };

  const parsed = subscriptionFormSchema.safeParse({
    plan: formData.get("plan") ?? "basico",
    priceGs: formData.get("priceGs") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    expiresAt: formData.get("expiresAt") ?? "",
    status: formData.get("status") ?? "active",
  });
  if (!parsed.success) {
    return { error: "Formuläret innehåller fel.", fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const values = parsed.data;
  if (values.expiresAt <= values.startsAt) {
    return { error: "Perioden är fel.", fieldErrors: { expiresAt: "Slutdatum måste ligga efter startdatum." } };
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
    if (!current || current.id !== existingId) return { error: "Prenumerationen hör inte till den här sajten." };
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
  return { ok: "Prenumerationen är sparad." };
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
  if (!business) return { error: "Sajten finns inte." };

  const subscription = await getCurrentSubscription(businessId);
  if (!subscription) return { error: "Skapa en prenumeration först — en betalning hör alltid till en period." };

  const parsed = paymentFormSchema.safeParse({
    amountGs: formData.get("amountGs") ?? "",
    method: formData.get("method") ?? "transferencia",
    reference: formData.get("reference") ?? "",
    periodStart: formData.get("periodStart") ?? "",
    periodEnd: formData.get("periodEnd") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: "Formuläret innehåller fel.", fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const values = parsed.data;
  if (values.periodEnd <= values.periodStart) {
    return { error: "Perioden är fel.", fieldErrors: { periodEnd: "Slutdatum måste ligga efter startdatum." } };
  }

  let receiptMediaId: number | null = null;
  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return { error: "Kvittot är större än 10 MB.", fieldErrors: { receipt: "Max 10 MB." } };
    }
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
      return { error: "Formatet stöds inte.", fieldErrors: { receipt: "Använd JPEG, PNG, WEBP eller HEIC." } };
    }
    try {
      const processed = await processImage({
        businessId,
        buffer: Buffer.from(await file.arrayBuffer()),
        kind: "receipt",
      });
      const [inserted] = await db.insert(media).values({
        businessId,
        kind: "receipt",
        fileKey: processed.fileKey,
        mime: processed.mime,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
        variantsJson: processed.variants,
        altText: `Comprobante ${values.reference || toDayString(new Date())}`,
      });
      receiptMediaId = Number(inserted.insertId);
    } catch {
      return { error: "Kvittobilden gick inte att läsa.", fieldErrors: { receipt: "Är filen skadad?" } };
    }
  }

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
  return { ok: "Betalningen är registrerad. Bekräfta den när pengarna syns." };
}

async function loadPayment(paymentId: number) {
  const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  return rows[0] ?? null;
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
  if (!payment) throw new Error("Betalningen finns inte.");
  if (payment.status === "confirmed") redirect(back);

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, payment.subscriptionId))
    .limit(1);
  if (!subscription) throw new Error("Prenumerationen finns inte.");

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

  // Betalt igen ⇒ sajten upp. Bara om den pausades — ett utkast ska inte
  // publiceras av en betalning.
  if (business?.status === "paused") {
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
      reactivated: business?.status === "paused",
    },
  });

  refresh(payment.businessId);
  redirect(`${back}?ok=${encodeURIComponent("Betalningen är bekräftad.")}`);
}

export async function rejectPaymentAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const paymentId = Number(formData.get("paymentId"));
  const back = String(formData.get("back") ?? "/admin/pagos");

  const payment = await loadPayment(paymentId);
  if (!payment) throw new Error("Betalningen finns inte.");

  await db.update(payments).set({ status: "rejected" }).where(eq(payments.id, paymentId));
  await logActivity({
    actorUserId: user.userId,
    businessId: payment.businessId,
    action: "payment_rejected",
    meta: { paymentId, amountGs: payment.amountGs },
  });

  refresh(payment.businessId);
  redirect(`${back}?ok=${encodeURIComponent("Betalningen är avvisad.")}`);
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

  const summary = `Respit: ${result.toGrace}. Förfallna: ${result.toExpired}. Pausade sajter: ${result.pausedBusinesses.length}.`;
  redirect(`/admin/pagos?ok=${encodeURIComponent(summary)}`);
}
