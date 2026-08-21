"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { businesses, media } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { logActivity, requireRole } from "@/lib/auth";
import { deleteMediaFiles } from "@/lib/media";
import { moveMediaWithinKind } from "@/lib/media-order";

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
  const direction = String(formData.get("direction")) === "up" ? "up" : "down";

  const row = await loadMedia(mediaId);
  if (!row) return;
  if (!(await moveMediaWithinKind({ businessId: row.businessId, mediaId, direction }))) return;

  const business = await getBusinessById(row.businessId);
  if (business) revalidateTag(`biz:${business.slug}`);
  revalidatePath(`/admin/sitios/${row.businessId}`);
  revalidatePath("/mi-sitio");
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
