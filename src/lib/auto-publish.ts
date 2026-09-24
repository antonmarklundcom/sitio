import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, media, subscriptions } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { getGrowthSettings } from "@/db/growth-queries";
import { logActivity } from "./auth";
import { polishBusiness } from "./ai-polish";
import { addDays, daysUntil, parseDay, todayAsuncion } from "./billing";
import { publishBlockers } from "./business";
import { ensureOwnerAccount } from "./owner";

/**
 * Provperioden startar vid första publiceringen (growth-1, besvarar frågan
 * 2026-09-23 i decisions-needed.md): dagar i din granskningskö ska inte äta
 * av kundens gratisperiod. Längden behålls — bara fönstret flyttas till idag.
 * Rör bara en prenumeration som fortfarande är `trial`, och bara en gång:
 * anropas när `publishedAt` var null.
 */
export async function startTrialAtPublish(businessId: number, actorUserId: number | null): Promise<void> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .orderBy(desc(subscriptions.expiresAt), desc(subscriptions.id))
    .limit(1);
  if (!sub || sub.status !== "trial") return;
  const length = Math.max(1, daysUntil(sub.expiresAt, sub.startsAt));
  const today = todayAsuncion();
  const startsAt = parseDay(today);
  const expiresAt = addDays(today, length);
  await db.update(subscriptions).set({ startsAt, expiresAt }).where(eq(subscriptions.id, sub.id));
  await logActivity({
    actorUserId,
    businessId,
    action: "trial_desde_publicacion",
    meta: { days: length, startsAt: today, expiresAt: expiresAt.toISOString().slice(0, 10) },
  });
}

function seoFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 155) return clean;
  const cut = clean.slice(0, 154);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(" ")))}…`;
}

/**
 * Autopublicering efter inlämnat intake (growth-1, idé 15). Körs i `after()`
 * så att kunden inte väntar på AI-anropet. Påslagen i /admin/crecimiento.
 *
 * 1. AI-puts av alla fält om nyckeln finns; annars blir kundens råtext
 *    beskrivningen och SEO-texten dess början.
 * 2. Samma publiceringsspärrar som när du publicerar för hand. Fastnar
 *    sajten ligger den kvar i pending_review, precis som utan autopublicering.
 * 3. Publicera, markera "needs_review", starta provperioden, skapa owner-konto.
 *
 * Kastar aldrig: allt som går fel lämnar sajten i din vanliga kö.
 */
export async function autoPublishAfterIntake(businessId: number): Promise<void> {
  try {
    const settings = await getGrowthSettings();
    if (!settings.autoPublish) return;
    let business = await getBusinessById(businessId);
    if (!business || business.status !== "pending_review") return;

    const polish = await polishBusiness(business);
    if (polish.ok) {
      await db
        .update(businesses)
        .set({
          description: polish.result.description,
          seoTitle: polish.result.seoTitle,
          seoDescription: polish.result.seoDescription,
          servicesJson: polish.result.services,
          aiPolishedAt: new Date(),
        })
        .where(eq(businesses.id, businessId));
      await logActivity({ businessId, action: "ai_polish_applied", meta: { auto: true, model: polish.usage.model, warnings: polish.warnings } });
    } else {
      const raw = (business.rawDescription ?? "").trim();
      const description = business.description?.trim() || raw;
      await db
        .update(businesses)
        .set({ description: description || null, seoDescription: business.seoDescription || (description ? seoFrom(description) : null) })
        .where(eq(businesses.id, businessId));
      await logActivity({ businessId, action: "autopublicacion_sin_ia", meta: { reason: polish.error.slice(0, 200) } });
    }

    business = await getBusinessById(businessId);
    if (!business) return;
    const [{ photos }] = await db
      .select({ photos: count() })
      .from(media)
      .where(and(eq(media.businessId, businessId), eq(media.kind, "photo")));
    const blockers = publishBlockers(business, Number(photos));
    if (blockers.length > 0) {
      await logActivity({ businessId, action: "autopublicacion_bloqueada", meta: { blockers } });
      return;
    }

    // Villkorat: publicerar bara om ingen hunnit ändra status under AI-anropet.
    const [res] = await db
      .update(businesses)
      .set({ status: "published", publishedAt: business.publishedAt ?? new Date(), needsReview: true })
      .where(and(eq(businesses.id, businessId), eq(businesses.status, "pending_review")));
    if (!res.affectedRows) return;

    if (!business.publishedAt) await startTrialAtPublish(businessId, null);
    const owner = await ensureOwnerAccount({ ...business, status: "published" });
    if (owner.ok && owner.created) {
      await logActivity({ businessId, action: "owner_account_created_on_publish", meta: { userId: owner.userId, auto: true } });
    }
    await logActivity({ businessId, action: "status_published", meta: { from: "pending_review", to: "published", auto: true } });

    revalidateTag(`biz:${business.slug}`);
    revalidatePath("/sitemap.xml");
    revalidatePath("/admin");
    revalidatePath("/admin/crecimiento");
  } catch (error) {
    console.error("[auto-publish]", businessId, error);
  }
}
