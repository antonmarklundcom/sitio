"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { businesses, media } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { logActivity, requireRole } from "@/lib/auth";
import { deleteMediaFiles } from "@/lib/media";

async function loadMedia(mediaId: number) {
  const [row] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  return row ?? null;
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const mediaId = Number(formData.get("mediaId"));
  const row = await loadMedia(mediaId);
  if (!row) return;

  // Filerna först: en DB-rad utan filer är ett trasigt kort på sajten,
  // en fil utan DB-rad är bara bortglömda bytes.
  await deleteMediaFiles(row.businessId, row.variantsJson ?? {});
  await db.delete(media).where(eq(media.id, mediaId));

  // Rensa referenser så att sajten inte pekar på ett raderat media.
  await db
    .update(businesses)
    .set({ logoMediaId: null })
    .where(and(eq(businesses.id, row.businessId), eq(businesses.logoMediaId, mediaId)));
  await db
    .update(businesses)
    .set({ heroMediaId: null })
    .where(and(eq(businesses.id, row.businessId), eq(businesses.heroMediaId, mediaId)));

  const business = await getBusinessById(row.businessId);
  await logActivity({
    actorUserId: user.userId,
    businessId: row.businessId,
    action: "media_deleted",
    meta: { mediaId, kind: row.kind },
  });

  if (business) revalidateTag(`biz:${business.slug}`);
  revalidatePath(`/admin/sitios/${row.businessId}`);
}

export async function moveMediaAction(formData: FormData): Promise<void> {
  await requireRole("superadmin");
  const mediaId = Number(formData.get("mediaId"));
  const direction = String(formData.get("direction")) === "up" ? -1 : 1;

  const row = await loadMedia(mediaId);
  if (!row) return;

  const siblings = await db
    .select()
    .from(media)
    .where(and(eq(media.businessId, row.businessId), eq(media.kind, row.kind)))
    .orderBy(asc(media.sortOrder), asc(media.id));

  const index = siblings.findIndex((s) => s.id === mediaId);
  const target = siblings[index + direction];
  if (!target) return;

  // Byt plats genom att skriva om hela ordningen — robustare än att byta två
  // sortOrder-värden som kan ha kolliderat sedan tidigare.
  const reordered = [...siblings];
  reordered[index] = target;
  reordered[index + direction] = row;

  for (const [i, item] of reordered.entries()) {
    await db.update(media).set({ sortOrder: i }).where(eq(media.id, item.id));
  }

  const business = await getBusinessById(row.businessId);
  if (business) revalidateTag(`biz:${business.slug}`);
  revalidatePath(`/admin/sitios/${row.businessId}`);
}

export async function setHeroAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const mediaId = Number(formData.get("mediaId"));
  const row = await loadMedia(mediaId);
  if (!row || row.kind !== "photo") return;

  await db.update(businesses).set({ heroMediaId: mediaId }).where(eq(businesses.id, row.businessId));
  await logActivity({
    actorUserId: user.userId,
    businessId: row.businessId,
    action: "hero_changed",
    meta: { mediaId },
  });

  const business = await getBusinessById(row.businessId);
  if (business) revalidateTag(`biz:${business.slug}`);
  revalidatePath(`/admin/sitios/${row.businessId}`);
}

export async function updateAltTextAction(formData: FormData): Promise<void> {
  await requireRole("superadmin");
  const mediaId = Number(formData.get("mediaId"));
  const altText = String(formData.get("altText") ?? "").slice(0, 160);

  const row = await loadMedia(mediaId);
  if (!row) return;

  await db.update(media).set({ altText: altText || null }).where(eq(media.id, mediaId));

  const business = await getBusinessById(row.businessId);
  if (business) revalidateTag(`biz:${business.slug}`);
  revalidatePath(`/admin/sitios/${row.businessId}`);
}

/** Alla bilder för ett business, sorterade. */
export async function listMediaForBusiness(businessId: number) {
  await requireRole("superadmin");
  return db
    .select()
    .from(media)
    .where(and(eq(media.businessId, businessId), ne(media.kind, "receipt")))
    .orderBy(asc(media.kind), asc(media.sortOrder), asc(media.id));
}
