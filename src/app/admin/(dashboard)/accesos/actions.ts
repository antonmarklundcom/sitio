"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, verifications } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { logActivity, requireRole } from "@/lib/auth";
import { ensureOwnerAccount } from "@/lib/owner";
import { OTP_TTL_MINUTES, hashOtp, newOtpCode } from "@/lib/intake";

export type OwnerCodeState = { error?: string; code?: string };

/**
 * Genererar en inloggningskod åt en owner och visar den EN gång. Bara hashen
 * lagras — tappad kod ersätts av en ny. Du skickar den från din egen WhatsApp
 * tills Cloud API finns (PR-17).
 */
export async function generateOwnerCodeAction(
  userId: number,
  _prev: OwnerCodeState,
  _formData: FormData,
): Promise<OwnerCodeState> {
  const admin = await requireRole("superadmin");

  const [owner] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!owner || owner.role !== "owner" || !owner.phone) return { error: "Kontot finns inte." };
  if (owner.status !== "active") return { error: "Kontot är avstängt." };

  const code = newOtpCode();
  await db.insert(verifications).values({
    phone: owner.phone,
    userId: owner.id,
    purpose: "login",
    codeHash: hashOtp(code),
    channel: "whatsapp_manual",
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
  });

  await logActivity({
    actorUserId: admin.userId,
    action: "owner_login_code_generated",
    // Koden loggas aldrig — bara att en kod skapades och till vilket nummer.
    meta: { ownerUserId: owner.id, phone: owner.phone },
  });

  revalidatePath("/admin/accesos");
  return { code };
}

/**
 * Skapar owner-kontot i efterhand. Publicering gör det automatiskt, men sajter
 * som publicerades före PR-11 har inget konto — och ett verifierat nummer kan
 * ha bytts efter publicering.
 */
export async function ensureOwnerAccountAction(formData: FormData): Promise<void> {
  const admin = await requireRole("superadmin");
  const businessId = Number(formData.get("businessId"));

  const business = await getBusinessById(businessId);
  if (!business) throw new Error("Sajten finns inte.");

  const result = await ensureOwnerAccount(business);
  const message = result.ok
    ? result.created
      ? `Owner-konto skapat för ${business.name}.`
      : `${business.name} hade redan ett konto — kopplingen är uppdaterad.`
    : result.reason === "not_verified"
      ? `${business.name} har inget verifierat WhatsApp-nummer. Verifiera först.`
      : `Numret används redan av ett annat owner-konto. Lös det för hand.`;

  if (result.ok) {
    await logActivity({
      actorUserId: admin.userId,
      businessId,
      action: "owner_account_ensured",
      meta: { userId: result.userId, created: result.created },
    });
  }

  revalidatePath("/admin/accesos");
  revalidatePath(`/admin/sitios/${businessId}`);
  redirect(`/admin/accesos?ok=${encodeURIComponent(message)}`);
}

/** Stänger av ett owner-konto. Sajten påverkas inte — bara inloggningen. */
export async function setOwnerStatusAction(formData: FormData): Promise<void> {
  const admin = await requireRole("superadmin");
  const userId = Number(formData.get("userId"));
  const status = String(formData.get("status")) === "disabled" ? "disabled" : "active";

  await db.update(users).set({ status }).where(eq(users.id, userId));
  await logActivity({
    actorUserId: admin.userId,
    action: "owner_status_changed",
    meta: { ownerUserId: userId, status },
  });

  revalidatePath("/admin/accesos");
  redirect(`/admin/accesos?ok=${encodeURIComponent(status === "disabled" ? "Kontot är avstängt." : "Kontot är aktivt igen.")}`);
}
