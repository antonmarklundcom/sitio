"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, onboardingTokens, verifications } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { logActivity, requireRole } from "@/lib/auth";
import { normalizePyPhone } from "@/lib/format";
import { slugify, uniqueSlugCandidate } from "@/lib/slug";
import {
  OTP_TTL_MINUTES,
  TOKEN_TTL_DAYS,
  hashOtp,
  newIntakeToken,
  newOtpCode,
  tokenFingerprint,
} from "@/lib/intake";

export type IntakeAdminState = { error?: string; fieldErrors?: Record<string, string>; ok?: string };

/**
 * Skapar ett utkast och en tokenad intake-länk i ett steg. Utkastet finns
 * redan när kunden öppnar länken — då blir varje fält kunden fyller i en
 * uppdatering av en rad som du kan se, i stället för ett formulär som lever i
 * webbläsaren tills det skickas.
 */
export async function createIntakeLinkAction(
  _prev: IntakeAdminState,
  formData: FormData,
): Promise<IntakeAdminState> {
  const user = await requireRole("superadmin");

  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || "Asunción";
  const category = String(formData.get("category") ?? "otro");

  if (name.length < 2) return { error: "Ange företagets namn.", fieldErrors: { name: "Minst två tecken." } };

  const phone = phoneRaw ? normalizePyPhone(phoneRaw) : null;
  if (phoneRaw && !phone) {
    return { error: "Numret går inte att tolka.", fieldErrors: { phone: "Ex: 0981 123 456" } };
  }

  const taken = await db.select({ slug: businesses.slug }).from(businesses);
  const slug = uniqueSlugCandidate(
    slugify(name) || "negocio",
    new Set(taken.map((t) => t.slug)),
  );

  const [inserted] = await db.insert(businesses).values({
    slug,
    name: name.slice(0, 120),
    category: category as "otro",
    themeKey: category === "otro" ? "servicios" : (category as "servicios"),
    city,
    // Numret är obekräftat tills kunden matar in koden — men det behövs som
    // platshållare eftersom kolumnen är NOT NULL. Verifieringen är det som
    // spärrar publicering, inte fältets existens.
    whatsappPhone: phone ?? "+595000000000",
    status: "draft",
  });

  const businessId = Number(inserted.insertId);
  const token = newIntakeToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000);

  await db.insert(onboardingTokens).values({
    token,
    businessId,
    phone,
    prefillJson: { name, city, category },
    createdByUserId: user.userId,
    expiresAt,
  });

  await logActivity({
    actorUserId: user.userId,
    businessId,
    action: "intake_link_created",
    meta: { tokenFingerprint: tokenFingerprint(token), expiresAt: expiresAt.toISOString() },
  });

  revalidatePath("/admin/alta");
  revalidatePath("/admin");
  return { ok: `Länken är skapad för ${name}.` };
}

/**
 * Genererar en OTP-kod och returnerar den EN gång, till dig. Koden lagras bara
 * som hash — tappas den bort genereras en ny. Du skickar den från din egen
 * WhatsApp tills Cloud API finns (PR-17).
 */
export type OtpState = { error?: string; code?: string; expiresAt?: string };

export async function generateOtpAction(
  businessId: number,
  _prev: OtpState,
  _formData: FormData,
): Promise<OtpState> {
  const user = await requireRole("superadmin");

  const business = await getBusinessById(businessId);
  if (!business) return { error: "Sajten finns inte." };

  const code = newOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await db.insert(verifications).values({
    phone: business.whatsappPhone,
    businessId,
    purpose: "onboarding",
    codeHash: hashOtp(code),
    channel: "whatsapp_manual",
    expiresAt,
  });

  await logActivity({
    actorUserId: user.userId,
    businessId,
    action: "otp_generated",
    // Koden loggas aldrig. Bara att en kod skapades, och för vilket nummer.
    meta: { phone: business.whatsappPhone, channel: "whatsapp_manual" },
  });

  revalidatePath("/admin/alta");
  return { code, expiresAt: expiresAt.toISOString() };
}

/** Stänger en länk i förtid — t.ex. när affären inte blev av. */
export async function revokeIntakeLinkAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const tokenId = Number(formData.get("tokenId"));

  const [row] = await db.select().from(onboardingTokens).where(eq(onboardingTokens.id, tokenId)).limit(1);
  if (!row) throw new Error("Länken finns inte.");

  await db
    .update(onboardingTokens)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(onboardingTokens.id, tokenId));

  await logActivity({
    actorUserId: user.userId,
    businessId: row.businessId,
    action: "intake_link_revoked",
    meta: { tokenFingerprint: tokenFingerprint(row.token) },
  });

  revalidatePath("/admin/alta");
  redirect(`/admin/alta?ok=${encodeURIComponent("Länken är stängd.")}`);
}
