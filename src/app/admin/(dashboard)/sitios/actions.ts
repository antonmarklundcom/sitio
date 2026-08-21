"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, media, slugRedirects } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { logActivity, requireRole } from "@/lib/auth";
import { ensureOwnerAccount } from "@/lib/owner";
import {
  businessFormSchema,
  canTransition,
  hoursFromFormData,
  publishBlockers,
  servicesFromFormData,
  type BusinessStatus,
} from "@/lib/business";

export type BusinessFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseForm(formData: FormData) {
  return businessFormSchema.safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    category: formData.get("category") ?? "otro",
    themeKey: formData.get("themeKey") ?? "servicios",
    paletteVariant: formData.get("paletteVariant") ?? 1,
    rawDescription: formData.get("rawDescription") ?? "",
    description: formData.get("description") ?? "",
    servicesJson: servicesFromFormData(formData),
    whatsappPhone: formData.get("whatsappPhone") ?? "",
    secondaryPhone: formData.get("secondaryPhone") ?? "",
    address: formData.get("address") ?? "",
    zone: formData.get("zone") ?? "",
    city: formData.get("city") ?? "",
    lat: formData.get("lat") ?? "",
    lng: formData.get("lng") ?? "",
    mapsUrl: formData.get("mapsUrl") ?? "",
    socialsJson: {
      instagram: formData.get("social.instagram") ?? "",
      facebook: formData.get("social.facebook") ?? "",
      tiktok: formData.get("social.tiktok") ?? "",
    },
    hoursJson: hoursFromFormData(formData),
    ruc: formData.get("ruc") ?? "",
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
    adminNotes: formData.get("adminNotes") ?? "",
  });
}

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function cleanSocials(socials: { instagram?: string | null; facebook?: string | null; tiktok?: string | null }) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(socials)) if (v) out[k] = v;
  return out;
}

export async function createBusinessAction(
  _prev: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  const user = await requireRole("superadmin");
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: "Formuläret innehåller fel.", fieldErrors: toFieldErrors(parsed.error.issues) };

  const values = parsed.data;

  const slugTaken = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, values.slug)).limit(1);
  if (slugTaken.length > 0) {
    return { error: "Länken är upptagen.", fieldErrors: { slug: "En sajt använder redan den länken." } };
  }
  const redirectTaken = await db
    .select({ id: slugRedirects.id })
    .from(slugRedirects)
    .where(eq(slugRedirects.oldSlug, values.slug))
    .limit(1);
  if (redirectTaken.length > 0) {
    return { error: "Länken pekar redan om till en annan sajt.", fieldErrors: { slug: "Länken används av en 301-omdirigering." } };
  }

  await db.insert(businesses).values({
    ...values,
    socialsJson: cleanSocials(values.socialsJson),
    status: "draft",
  });

  const [created] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, values.slug)).limit(1);
  await logActivity({ actorUserId: user.userId, businessId: created.id, action: "business_created", meta: { slug: values.slug } });

  revalidatePath("/admin");
  redirect(`/admin/sitios/${created.id}?created=1`);
}

export async function updateBusinessAction(
  businessId: number,
  _prev: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  const user = await requireRole("superadmin");
  const existing = await getBusinessById(businessId);
  if (!existing) return { error: "Sajten finns inte." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: "Formuläret innehåller fel.", fieldErrors: toFieldErrors(parsed.error.issues) };

  const values = parsed.data;
  const slugChanged = values.slug !== existing.slug;

  if (slugChanged) {
    const taken = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.slug, values.slug), ne(businesses.id, businessId)))
      .limit(1);
    if (taken.length > 0) {
      return { error: "Länken är upptagen.", fieldErrors: { slug: "En annan sajt använder redan den länken." } };
    }
  }

  await db
    .update(businesses)
    .set({ ...values, socialsJson: cleanSocials(values.socialsJson) })
    .where(eq(businesses.id, businessId));

  if (slugChanged) {
    // 301 från den gamla länken. Har sajten aldrig varit publicerad finns inget
    // index att bevara, men raden kostar inget och skyddar mot fel-antaganden.
    await db
      .insert(slugRedirects)
      .values({ oldSlug: existing.slug, businessId })
      .onDuplicateKeyUpdate({ set: { businessId } });

    // En slug som återanvänds får inte samtidigt peka om någon annanstans.
    await db.delete(slugRedirects).where(eq(slugRedirects.oldSlug, values.slug));

    await logActivity({
      actorUserId: user.userId,
      businessId,
      action: "slug_changed",
      meta: { from: existing.slug, to: values.slug },
    });
    revalidateTag(`biz:${existing.slug}`);
  }

  await logActivity({ actorUserId: user.userId, businessId, action: "business_updated" });

  revalidateTag(`biz:${values.slug}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/sitios/${businessId}`);

  return {};
}

export async function changeStatusAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const businessId = Number(formData.get("businessId"));
  const to = String(formData.get("to")) as BusinessStatus;

  const business = await getBusinessById(businessId);
  if (!business) throw new Error("Sajten finns inte.");

  const from = business.status as BusinessStatus;
  if (!canTransition(from, to)) {
    redirect(`/admin/sitios/${businessId}?error=${encodeURIComponent(`Övergången ${from} → ${to} är inte tillåten.`)}`);
  }

  if (to === "published") {
    const [{ photoCount }] = await db
      .select({ photoCount: sql<number>`count(*)` })
      .from(media)
      .where(and(eq(media.businessId, businessId), eq(media.kind, "photo")));
    const blockers = publishBlockers(business, Number(photoCount));
    if (blockers.length > 0) {
      redirect(`/admin/sitios/${businessId}?error=${encodeURIComponent(`Kan inte publicera: ${blockers.join(" ")}`)}`);
    }
  }

  await db
    .update(businesses)
    .set({
      status: to,
      publishedAt: to === "published" && !business.publishedAt ? new Date() : business.publishedAt,
    })
    .where(eq(businesses.id, businessId));

  // Owner-kontot skapas vid publicering: det är först då kunden har något att
  // logga in på. Misslyckas det (numret hör redan till ett annat konto) ska
  // publiceringen stå kvar — kontot fixas för hand i /admin/accesos, och
  // publishBlockers har redan garanterat att numret är verifierat.
  let ownerNote = "";
  if (to === "published") {
    const owner = await ensureOwnerAccount({ ...business, status: to });
    if (owner.ok) {
      if (owner.created) {
        await logActivity({
          actorUserId: user.userId,
          businessId,
          action: "owner_account_created_on_publish",
          meta: { userId: owner.userId },
        });
      }
    } else {
      ownerNote = `&ownerWarning=${encodeURIComponent(
        owner.reason === "phone_taken"
          ? "Sajten är publicerad, men numret hör redan till ett annat owner-konto. Lös det i Inloggningar."
          : "Sajten är publicerad, men WhatsApp-numret är inte verifierat — inget owner-konto skapades.",
      )}`;
    }
  }

  await logActivity({
    actorUserId: user.userId,
    businessId,
    action: `status_${to}`,
    meta: { from, to },
  });

  revalidateTag(`biz:${business.slug}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/sitios/${businessId}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/accesos");
  redirect(`/admin/sitios/${businessId}?status=1${ownerNote}`);
}

export async function verifyWhatsappManuallyAction(formData: FormData): Promise<void> {
  const user = await requireRole("superadmin");
  const businessId = Number(formData.get("businessId"));
  const business = await getBusinessById(businessId);
  if (!business) throw new Error("Sajten finns inte.");

  await db.update(businesses).set({ whatsappVerifiedAt: new Date() }).where(eq(businesses.id, businessId));
  await logActivity({
    actorUserId: user.userId,
    businessId,
    action: "whatsapp_verified_manual",
    meta: { phone: business.whatsappPhone },
  });

  revalidatePath(`/admin/sitios/${businessId}`);
  redirect(`/admin/sitios/${businessId}?verified=1`);
}
