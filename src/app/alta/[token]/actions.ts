"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, onboardingTokens, verifications } from "@/db/schema";
import { getIntakeSession } from "@/db/intake-queries";
import { logActivity } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  OTP_MAX_ATTEMPTS,
  hoursFromIntake,
  intakeDataSchema,
  otpMatches,
  servicesFromIntake,
  tokenFingerprint,
} from "@/lib/intake";

export type IntakeState = { error?: string; fieldErrors?: Record<string, string>; ok?: string };

/**
 * Alla åtgärder här är PUBLIKA — de skyddas av token, inte av en session.
 * Därför slår varje åtgärd upp token på nytt och litar aldrig på ett
 * businessId från formuläret.
 */
async function requireSession(token: string) {
  const session = await getIntakeSession(token);
  if (!session) return null;
  return session;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) out[issue.path.map(String).join(".") || "_"] ??= issue.message;
  return out;
}

export async function saveIntakeDataAction(
  token: string,
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const session = await requireSession(token);
  if (!session) return { error: "Este enlace ya no es válido. Escribinos por WhatsApp y te mandamos uno nuevo." };

  if (!rateLimit(`intake:${tokenFingerprint(token)}`, 40, 60_000).ok) {
    return { error: "Demasiados intentos. Esperá un minuto." };
  }

  const parsed = intakeDataSchema.safeParse({
    name: formData.get("name") ?? "",
    category: formData.get("category") ?? "otro",
    rawDescription: formData.get("rawDescription") ?? "",
    whatsappPhone: formData.get("whatsappPhone") ?? "",
    secondaryPhone: formData.get("secondaryPhone") ?? "",
    address: formData.get("address") ?? "",
    zone: formData.get("zone") ?? "",
    city: formData.get("city") ?? "",
    instagram: formData.get("instagram") ?? "",
    facebook: formData.get("facebook") ?? "",
  });
  if (!parsed.success) {
    return { error: "Revisá los campos marcados.", fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const values = parsed.data;
  const services = servicesFromIntake(formData);
  if (services.length < 2) {
    return {
      error: "Necesitamos al menos dos servicios o productos.",
      fieldErrors: { "service.1.name": "Agregá al menos dos." },
    };
  }

  const socials: Record<string, string> = {};
  if (values.instagram) socials.instagram = values.instagram;
  if (values.facebook) socials.facebook = values.facebook;

  // Byter kunden nummer måste verifieringen göras om — annars kunde ett
  // verifierat nummer bytas mot ett obekräftat efter godkännandet.
  const phoneChanged = values.whatsappPhone !== session.business.whatsappPhone;

  await db
    .update(businesses)
    .set({
      name: values.name,
      category: values.category,
      rawDescription: values.rawDescription,
      // description sätts av dig i admin (ev. med AI-puts). Kundens råtext
      // publiceras aldrig oredigerad.
      whatsappPhone: values.whatsappPhone,
      whatsappVerifiedAt: phoneChanged ? null : session.business.whatsappVerifiedAt,
      secondaryPhone: values.secondaryPhone || null,
      address: values.address || null,
      zone: values.zone || null,
      city: values.city,
      servicesJson: services,
      socialsJson: socials,
      hoursJson: hoursFromIntake(formData),
    })
    .where(eq(businesses.id, session.business.id));

  await logActivity({
    businessId: session.business.id,
    action: "intake_data_saved",
    meta: { services: services.length, phoneChanged },
  });

  revalidatePath(`/admin/sitios/${session.business.id}`);
  redirect(`/alta/${token}?paso=fotos`);
}

/**
 * Begär en kod. Koden genereras INTE här — den skapas av superadmin i
 * /admin/alta och skickas manuellt via WhatsApp (PLAN.md PR-10). Det här är
 * kundens signal om att hen väntar, så att den syns i adminvyn.
 */
export async function requestCodeAction(token: string, _prev: IntakeState, _formData: FormData): Promise<IntakeState> {
  const session = await requireSession(token);
  if (!session) return { error: "Este enlace ya no es válido." };

  if (!rateLimit(`intake-code:${tokenFingerprint(token)}`, 5, 300_000).ok) {
    return { error: "Ya pediste el código. Esperá unos minutos — te lo mandamos por WhatsApp." };
  }

  await logActivity({
    businessId: session.business.id,
    action: "otp_requested",
    meta: { phone: session.business.whatsappPhone },
  });

  revalidatePath("/admin/alta");
  return { ok: "Listo. Te mandamos el código por WhatsApp en unos minutos." };
}

export async function verifyCodeAction(token: string, _prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const session = await requireSession(token);
  if (!session) return { error: "Este enlace ya no es válido." };

  if (!rateLimit(`intake-otp:${tokenFingerprint(token)}`, 10, 600_000).ok) {
    return { error: "Demasiados intentos. Probá de nuevo en unos minutos." };
  }

  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "El código tiene 6 números.", fieldErrors: { code: "Seis números." } };

  const [row] = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.businessId, session.business.id),
        eq(verifications.purpose, "onboarding"),
        isNull(verifications.verifiedAt),
      ),
    )
    .orderBy(desc(verifications.createdAt))
    .limit(1);

  if (!row) return { error: "Todavía no hay un código activo. Pedilo con el botón de arriba." };
  if (row.expiresAt.getTime() < Date.now()) return { error: "El código venció. Pedí uno nuevo." };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { error: "Demasiados intentos con ese código. Pedí uno nuevo." };

  if (!otpMatches(code, row.codeHash)) {
    await db
      .update(verifications)
      .set({ attempts: sql`${verifications.attempts} + 1` })
      .where(eq(verifications.id, row.id));
    return { error: "Ese código no coincide.", fieldErrors: { code: "Revisá los números." } };
  }

  const now = new Date();
  await db.update(verifications).set({ verifiedAt: now }).where(eq(verifications.id, row.id));
  await db.update(businesses).set({ whatsappVerifiedAt: now }).where(eq(businesses.id, session.business.id));

  await logActivity({
    businessId: session.business.id,
    action: "whatsapp_verified_otp",
    meta: { phone: session.business.whatsappPhone, channel: row.channel },
  });

  revalidatePath(`/admin/sitios/${session.business.id}`);
  revalidatePath("/admin/alta");
  return { ok: "¡Número verificado!" };
}

/**
 * Inlämning: utkastet går till pending_review och länken stängs. Kunden ska
 * inte kunna fortsätta ändra i en sajt som ligger i din granskningskö — då
 * granskar du något annat än det som publiceras.
 */
export async function submitIntakeAction(token: string, _prev: IntakeState, _formData: FormData): Promise<IntakeState> {
  const session = await requireSession(token);
  if (!session) return { error: "Este enlace ya no es válido." };

  const b = session.business;
  const missing: string[] = [];
  if (!b.rawDescription || b.rawDescription.trim().length < 40) missing.push("la descripción");
  if (!Array.isArray(b.servicesJson) || b.servicesJson.length < 2) missing.push("dos servicios");
  if (!b.whatsappVerifiedAt) missing.push("la verificación de tu WhatsApp");
  if (session.photoCount < 1) missing.push("al menos una foto");

  if (missing.length > 0) {
    return { error: `Todavía falta ${missing.join(", ")}.` };
  }

  await db.update(businesses).set({ status: "pending_review" }).where(eq(businesses.id, b.id));
  await db.update(onboardingTokens).set({ usedAt: new Date() }).where(eq(onboardingTokens.id, session.tokenId));

  await logActivity({
    businessId: b.id,
    action: "intake_submitted",
    meta: { photos: session.photoCount, hasLogo: session.hasLogo },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/alta");
  redirect(`/alta/${token}?listo=1`);
}
