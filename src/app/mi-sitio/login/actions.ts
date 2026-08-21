"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, verifications } from "@/db/schema";
import { sql } from "drizzle-orm";
import { establishSession, logActivity } from "@/lib/auth";
import { findOwnerLoginTarget } from "@/lib/owner";
import { normalizePyPhone } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";
import { OTP_MAX_ATTEMPTS, otpMatches } from "@/lib/intake";

export type OwnerLoginState = { error?: string; ok?: string; phone?: string; step?: "phone" | "code" };

async function clientIp(): Promise<string> {
  const hdrs = await headers();
  return hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Steg 1: kunden anger sitt nummer och ber om en kod.
 *
 * Koden genereras INTE här. Superadmin skapar den i /admin/accesos och skickar
 * den från sin egen WhatsApp (PLAN.md D1 — manuellt tills PR-17). Den här
 * åtgärden loggar begäran så att den syns i adminvyn, och svarar exakt likadant
 * för kända och okända nummer: annars blir inloggningssidan ett sätt att ta
 * reda på vilka företag som är kunder.
 */
export async function requestOwnerCodeAction(
  _prev: OwnerLoginState,
  formData: FormData,
): Promise<OwnerLoginState> {
  const raw = String(formData.get("phone") ?? "");
  const phone = normalizePyPhone(raw);
  const ip = await clientIp();

  if (!rateLimit(`owner-code:ip:${ip}`, 8, 15 * 60_000).ok) {
    return { error: "Demasiados intentos. Probá de nuevo en un rato.", step: "phone" };
  }

  if (!phone) {
    return { error: "Ese número no parece paraguayo. Ej: 0981 123 456", step: "phone" };
  }

  if (!rateLimit(`owner-code:phone:${phone}`, 4, 15 * 60_000).ok) {
    return { error: "Ya pediste el código. Esperá unos minutos.", step: "phone", phone };
  }

  const target = await findOwnerLoginTarget(phone);
  if (target) {
    await logActivity({
      actorUserId: target.userId,
      businessId: target.businessId,
      action: "owner_login_requested",
      meta: { phone, ip },
    });
    revalidatePath("/admin/accesos");
  } else {
    // Loggas utan business: det är ändå värt att se att någon försökte.
    await logActivity({ action: "owner_login_requested_unknown", meta: { phone, ip } });
  }

  return {
    ok: "Si el número está registrado, te mandamos un código por WhatsApp en unos minutos.",
    step: "code",
    phone,
  };
}

/** Steg 2: kunden matar in koden och får en session. */
export async function verifyOwnerCodeAction(
  _prev: OwnerLoginState,
  formData: FormData,
): Promise<OwnerLoginState> {
  const phone = normalizePyPhone(String(formData.get("phone") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const ip = await clientIp();

  if (!rateLimit(`owner-verify:ip:${ip}`, 15, 15 * 60_000).ok) {
    return { error: "Demasiados intentos. Probá de nuevo en un rato.", step: "code" };
  }
  if (!phone) return { error: "Volvé a escribir tu número.", step: "phone" };
  if (code.length !== 6) return { error: "El código tiene 6 números.", step: "code", phone };

  const target = await findOwnerLoginTarget(phone);
  if (!target) {
    await logActivity({ action: "owner_login_failed", meta: { phone, ip, reason: "unknown_phone" } });
    return { error: "No pudimos verificar ese código.", step: "code", phone };
  }

  const [row] = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.userId, target.userId),
        eq(verifications.purpose, "login"),
        isNull(verifications.verifiedAt),
      ),
    )
    .orderBy(desc(verifications.createdAt))
    .limit(1);

  // Samma svar oavsett om koden saknas, har gått ut eller är fel: skillnaden
  // hade avslöjat om numret finns och om en kod är på väg.
  const generic = { error: "No pudimos verificar ese código. Pedí uno nuevo.", step: "code" as const, phone };

  if (!row || row.expiresAt.getTime() < Date.now() || row.attempts >= OTP_MAX_ATTEMPTS) return generic;

  if (!otpMatches(code, row.codeHash)) {
    await db
      .update(verifications)
      .set({ attempts: sql`${verifications.attempts} + 1` })
      .where(eq(verifications.id, row.id));
    await logActivity({
      actorUserId: target.userId,
      businessId: target.businessId,
      action: "owner_login_failed",
      meta: { ip, reason: "bad_code" },
    });
    return generic;
  }

  await db.update(verifications).set({ verifiedAt: new Date() }).where(eq(verifications.id, row.id));
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, target.userId));

  await establishSession({
    userId: target.userId,
    role: "owner",
    name: target.businessName,
    businessId: target.businessId,
  });

  await logActivity({
    actorUserId: target.userId,
    businessId: target.businessId,
    action: "owner_login",
    meta: { ip },
  });

  revalidatePath("/admin/accesos");
  redirect("/mi-sitio");
}

export async function ownerLogoutAction(): Promise<void> {
  const { destroySession } = await import("@/lib/auth");
  const { currentUser } = await import("@/lib/session");
  const user = await currentUser();
  if (user?.userId) {
    await logActivity({ actorUserId: user.userId, businessId: user.businessId, action: "owner_logout" });
  }
  await destroySession();
  redirect("/mi-sitio/login");
}
