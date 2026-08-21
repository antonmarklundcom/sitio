"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, media } from "@/db/schema";
import { logActivity } from "@/lib/auth";
import { deleteMediaFiles } from "@/lib/media";
import { moveMediaWithinKind } from "@/lib/media-order";
import { ownerFormSchema, ownerHoursFromForm, ownerServicesFromForm } from "@/lib/owner-form";
import { ownerContext } from "@/lib/owner-context";

export type OwnerFormState = { error?: string; fieldErrors?: Record<string, string>; ok?: string };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) out[issue.path.map(String).join(".") || "_"] ??= issue.message;
  return out;
}

/**
 * Sparar de fält en owner får röra. Whitelistan ÄR säkerheten: tema, palett,
 * slug, status, SEO-fält och telefonnummer finns inte med, och kan därför inte
 * ändras ens av ett handskrivet formulär (PLAN.md §1.3 D).
 */
export async function updateOwnerBusinessAction(
  _prev: OwnerFormState,
  formData: FormData,
): Promise<OwnerFormState> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "No pudimos identificar tu negocio. Entrá de nuevo." };

  const parsed = ownerFormSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    address: formData.get("address") ?? "",
    zone: formData.get("zone") ?? "",
    city: formData.get("city") ?? "",
    secondaryPhone: formData.get("secondaryPhone") ?? "",
    mapsUrl: formData.get("mapsUrl") ?? "",
    instagram: formData.get("instagram") ?? "",
    facebook: formData.get("facebook") ?? "",
    tiktok: formData.get("tiktok") ?? "",
  });
  if (!parsed.success) {
    return { error: "Revisá los campos marcados.", fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const values = parsed.data;
  const services = ownerServicesFromForm(formData);
  if (services.length < 2) {
    return { error: "Necesitás al menos dos servicios o productos.", fieldErrors: { "service.0.name": "Al menos dos." } };
  }

  const socials: Record<string, string> = {};
  if (values.instagram) socials.instagram = values.instagram;
  if (values.facebook) socials.facebook = values.facebook;
  if (values.tiktok) socials.tiktok = values.tiktok;

  await db
    .update(businesses)
    .set({
      name: values.name,
      description: values.description,
      address: values.address || null,
      zone: values.zone || null,
      city: values.city,
      secondaryPhone: values.secondaryPhone || null,
      mapsUrl: values.mapsUrl || null,
      servicesJson: services,
      socialsJson: socials,
      hoursJson: ownerHoursFromForm(formData),
    })
    .where(eq(businesses.id, ctx.business.id));

  await logActivity({
    actorUserId: ctx.userId,
    businessId: ctx.business.id,
    action: "owner_updated_business",
    meta: { services: services.length },
  });

  revalidateTag(`biz:${ctx.business.slug}`);
  revalidatePath("/mi-sitio");
  revalidatePath(`/admin/sitios/${ctx.business.id}`);
  return { ok: "¡Guardado! Los cambios ya están en tu página." };
}

/** Sätter hero-bilden. Owner får välja vilken bild som ligger överst — inte var. */
export async function ownerSetHeroAction(formData: FormData): Promise<void> {
  const ctx = await ownerContext();
  if (!ctx) return;

  const mediaId = Number(formData.get("mediaId"));
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.businessId, ctx.business.id)))
    .limit(1);
  if (!row || row.kind !== "photo") return;

  await db.update(businesses).set({ heroMediaId: mediaId }).where(eq(businesses.id, ctx.business.id));
  await logActivity({
    actorUserId: ctx.userId,
    businessId: ctx.business.id,
    action: "owner_hero_changed",
    meta: { mediaId },
  });

  revalidateTag(`biz:${ctx.business.slug}`);
  revalidatePath("/mi-sitio");
}

/** Raderar en egen bild. Tenant-kontrollen ligger i WHERE-satsen, inte i UI:t. */
export async function ownerDeletePhotoAction(formData: FormData): Promise<void> {
  const ctx = await ownerContext();
  if (!ctx) return;

  const mediaId = Number(formData.get("mediaId"));
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.businessId, ctx.business.id)))
    .limit(1);
  if (!row) return;

  // Sista fotot får inte tas bort: en publicerad sajt utan bild ser trasig ut,
  // och det är kundens egen sajt som skulle se trasig ut.
  if (row.kind === "photo") {
    const photos = await db
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.businessId, ctx.business.id), eq(media.kind, "photo")))
      .orderBy(asc(media.sortOrder));
    if (photos.length <= 1) return;
  }

  await deleteMediaFiles(row.businessId, row.variantsJson ?? {});
  await db.delete(media).where(eq(media.id, mediaId));

  await db
    .update(businesses)
    .set({ logoMediaId: null })
    .where(and(eq(businesses.id, ctx.business.id), eq(businesses.logoMediaId, mediaId)));
  await db
    .update(businesses)
    .set({ heroMediaId: null })
    .where(and(eq(businesses.id, ctx.business.id), eq(businesses.heroMediaId, mediaId)));

  await logActivity({
    actorUserId: ctx.userId,
    businessId: ctx.business.id,
    action: "owner_media_deleted",
    meta: { mediaId, kind: row.kind },
  });

  revalidateTag(`biz:${ctx.business.slug}`);
  revalidatePath("/mi-sitio");
  revalidatePath(`/admin/sitios/${ctx.business.id}`);
}

/**
 * Sorterar om owners egna foton. Ordningen är inte en gallerifunktion utan en
 * grundfunktion: temana visar de tre till sex första bilderna när galleriet är
 * av, så ordningen avgör VILKA bilder kunden visar upp. Att låsa den bakom
 * modulen hade gjort basplanen sämre än den behöver vara — modulen höjer taket
 * och visar hela serien, den äger inte ordningen.
 *
 * businessId kommer ur sessionen: ett mediaId från en annan kund matchar
 * ingenting i WHERE-satsen och blir en no-op.
 */
export async function ownerMoveMediaAction(formData: FormData): Promise<void> {
  const ctx = await ownerContext();
  if (!ctx) return;

  const mediaId = Number(formData.get("mediaId"));
  const direction = String(formData.get("direction")) === "up" ? "up" : "down";
  if (!Number.isInteger(mediaId)) return;

  const moved = await moveMediaWithinKind({ businessId: ctx.business.id, mediaId, direction });
  if (!moved) return;

  await logActivity({
    actorUserId: ctx.userId,
    businessId: ctx.business.id,
    action: "owner_media_reordered",
    meta: { mediaId, direction },
  });

  revalidateTag(`biz:${ctx.business.slug}`);
  revalidatePath("/mi-sitio");
  revalidatePath(`/admin/sitios/${ctx.business.id}`);
}
