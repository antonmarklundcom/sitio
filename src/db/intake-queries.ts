import "server-only";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { businesses, media, onboardingTokens, verifications } from "./schema";
import type { Business } from "./schema";

export type IntakeSession = {
  tokenId: number;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  business: Business;
  photoCount: number;
  hasLogo: boolean;
};

/**
 * Slår upp en intake-token och sajten den hör till.
 *
 * Returnerar null för okänd, utgången eller redan inlämnad token — anroparen
 * ska aldrig kunna skilja fallen åt i UI:t, annars blir sidan en orakelfunktion
 * för giltiga tokens.
 */
export async function getIntakeSession(token: string): Promise<IntakeSession | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;

  const rows = await db
    .select({ tokenRow: onboardingTokens, business: businesses })
    .from(onboardingTokens)
    .innerJoin(businesses, eq(businesses.id, onboardingTokens.businessId))
    .where(and(eq(onboardingTokens.token, token), gt(onboardingTokens.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.tokenRow.usedAt) return null;
  // Ett arkiverat utkast ska inte gå att fylla i vidare.
  if (row.business.status === "archived") return null;

  const [counts] = await db
    .select({
      photos: sql<number>`sum(${media.kind} = 'photo')`,
      logos: sql<number>`sum(${media.kind} = 'logo')`,
    })
    .from(media)
    .where(eq(media.businessId, row.business.id));

  return {
    tokenId: row.tokenRow.id,
    token: row.tokenRow.token,
    expiresAt: row.tokenRow.expiresAt,
    usedAt: row.tokenRow.usedAt,
    business: row.business,
    photoCount: Number(counts?.photos ?? 0),
    hasLogo: Number(counts?.logos ?? 0) > 0,
  };
}

/** Samma uppslag, men bara id:t — används av uppladdningsroutens tokenläge. */
export async function getIntakeBusinessId(token: string): Promise<number | null> {
  const session = await getIntakeSession(token);
  return session?.business.id ?? null;
}

/**
 * Bilder för intake-sidan. Egen fråga i stället för adminets
 * listMediaForBusiness, som kräver superadmin — kunden med token har ingen
 * session, och att luckra upp adminfunktionen hade öppnat den för alla.
 */
export async function listIntakeMedia(businessId: number) {
  return db
    .select({ id: media.id, kind: media.kind, variantsJson: media.variantsJson, sortOrder: media.sortOrder })
    .from(media)
    .where(and(eq(media.businessId, businessId), inArray(media.kind, ["photo", "logo"])))
    .orderBy(media.sortOrder, media.id);
}

export type IntakeLinkRow = {
  id: number;
  token: string;
  businessId: number;
  businessName: string;
  businessStatus: string;
  phone: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  pendingCode: boolean;
  verifiedAt: Date | null;
};

/** Adminvyn: aktiva och nyligen använda länkar, nyast först. */
export async function listIntakeLinks(limit = 100): Promise<IntakeLinkRow[]> {
  const rows = await db
    .select({
      id: onboardingTokens.id,
      token: onboardingTokens.token,
      businessId: onboardingTokens.businessId,
      businessName: businesses.name,
      businessStatus: businesses.status,
      phone: onboardingTokens.phone,
      expiresAt: onboardingTokens.expiresAt,
      usedAt: onboardingTokens.usedAt,
      createdAt: onboardingTokens.createdAt,
      verifiedAt: businesses.whatsappVerifiedAt,
      pendingCode: sql<number>`(
        select count(*) from verifications v
        where v.business_id = \`onboarding_tokens\`.\`business_id\`
          and v.purpose = 'onboarding'
          and v.verified_at is null
          and v.expires_at > utc_timestamp()
      )`,
    })
    .from(onboardingTokens)
    .innerJoin(businesses, eq(businesses.id, onboardingTokens.businessId))
    .orderBy(desc(onboardingTokens.createdAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, pendingCode: Number(r.pendingCode) > 0 })) as IntakeLinkRow[];
}

/**
 * Senaste onboarding-verifieringen för en sajt — status, försök, utgång.
 *
 * Själva koden finns inte här och kan inte finnas här: bara hashen lagras.
 * Admin ser koden EN gång, i svaret från åtgärden som genererade den. Tappas
 * den bort genereras en ny. Det är hela poängen med att inte lagra den.
 */
export async function getLatestOnboardingVerification(businessId: number) {
  const rows = await db
    .select()
    .from(verifications)
    .where(and(eq(verifications.businessId, businessId), eq(verifications.purpose, "onboarding")))
    .orderBy(desc(verifications.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
