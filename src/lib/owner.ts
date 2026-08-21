import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { businesses, users } from "@/db/schema";
import { logActivity } from "./auth";
import type { Business } from "@/db/schema";

/**
 * Owner-konton (PR-11). Ett owner-konto är alltid bundet till exakt ett
 * business och har inget lösenord — inloggningen sker med WhatsApp-OTP mot ett
 * nummer som redan är verifierat i intaken.
 */

export type EnsureOwnerResult =
  | { ok: true; userId: number; created: boolean }
  | { ok: false; reason: "not_verified" | "phone_taken" };

/**
 * Skapar (eller återanvänder) owner-kontot för en sajt. Anropas vid
 * publicering — det är först då kunden har något att logga in på.
 *
 * Kräver ett verifierat WhatsApp-nummer: ett konto vars inloggning går till ett
 * obekräftat nummer är ett konto vem som helst kan ta över.
 */
export async function ensureOwnerAccount(business: Business): Promise<EnsureOwnerResult> {
  if (!business.whatsappVerifiedAt) return { ok: false, reason: "not_verified" };

  if (business.ownerUserId) {
    const [existing] = await db
      .select({ id: users.id, phone: users.phone })
      .from(users)
      .where(eq(users.id, business.ownerUserId))
      .limit(1);

    if (existing) {
      // Numret kan ha ändrats i admin efter att kontot skapades. Inloggningen
      // ska följa sajtens nummer, annars loggar fel person in.
      if (existing.phone !== business.whatsappPhone) {
        const [clash] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.phone, business.whatsappPhone), ne(users.id, existing.id)))
          .limit(1);
        if (clash) return { ok: false, reason: "phone_taken" };

        await db.update(users).set({ phone: business.whatsappPhone }).where(eq(users.id, existing.id));
      }
      return { ok: true, userId: existing.id, created: false };
    }
  }

  // Ett nummer kan bara höra till ett konto (unikt index u_phone). Har kunden
  // redan ett konto för en annan sajt måste det lösas för hand — annars hade
  // vi tyst flyttat en inloggning mellan två företag.
  const [taken] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.phone, business.whatsappPhone))
    .limit(1);

  if (taken) {
    const [ownsOther] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.ownerUserId, taken.id), ne(businesses.id, business.id)))
      .limit(1);
    if (ownsOther) return { ok: false, reason: "phone_taken" };

    await db.update(businesses).set({ ownerUserId: taken.id }).where(eq(businesses.id, business.id));
    return { ok: true, userId: taken.id, created: false };
  }

  const [inserted] = await db.insert(users).values({
    role: "owner",
    name: business.name.slice(0, 120),
    phone: business.whatsappPhone,
    status: "active",
  });

  const userId = Number(inserted.insertId);
  await db.update(businesses).set({ ownerUserId: userId }).where(eq(businesses.id, business.id));

  await logActivity({
    businessId: business.id,
    action: "owner_account_created",
    meta: { userId, phone: business.whatsappPhone },
  });

  return { ok: true, userId, created: true };
}

export type OwnerLoginTarget = {
  userId: number;
  name: string;
  businessId: number;
  businessName: string;
  slug: string;
  phone: string;
};

/**
 * Slår upp vilket owner-konto ett telefonnummer hör till. Returnerar null för
 * okända nummer, avstängda konton och konton utan publicerad sajt — alla tre
 * ser likadana ut utåt, annars blir inloggningen en kunddatabas att fiska i.
 */
export async function findOwnerLoginTarget(phone: string): Promise<OwnerLoginTarget | null> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      status: users.status,
      businessId: businesses.id,
      businessName: businesses.name,
      slug: businesses.slug,
      businessStatus: businesses.status,
      phone: users.phone,
    })
    .from(users)
    .innerJoin(businesses, eq(businesses.ownerUserId, users.id))
    .where(and(eq(users.phone, phone), eq(users.role, "owner")))
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== "active" || !row.phone) return null;
  if (row.businessStatus === "archived") return null;

  return {
    userId: row.userId,
    name: row.name,
    businessId: row.businessId,
    businessName: row.businessName,
    slug: row.slug,
    phone: row.phone,
  };
}
