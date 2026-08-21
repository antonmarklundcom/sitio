import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { getBusinessAnalytics } from "@/db/analytics-queries";
import { assertBusinessAccess, requireRole } from "@/lib/auth";
import { currentUser } from "@/lib/session";
import { absoluteUrl } from "@/lib/env";
import { displayPhone } from "@/lib/format";
import { MAX_PHOTOS_BASE, MAX_PHOTOS_GALLERY, smallestVariant } from "@/lib/media-shared";
import { businessModules } from "@/db/schema";
import { OwnerEditForm, OwnerPhotos } from "@/components/mi-sitio/owner-forms";
import { OwnerStats } from "@/components/mi-sitio/owner-stats";
import { ownerDeletePhotoAction, ownerSetHeroAction, updateOwnerBusinessAction } from "./actions";
import { ownerLogoutAction } from "./login/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi sitio", robots: { index: false, follow: false } };

export default async function MiSitioPage({
  searchParams,
}: {
  searchParams: Promise<{ sitio?: string }>;
}) {
  const session = await requireRole("owner", "superadmin");
  const user = await currentUser();
  const sp = await searchParams;

  // Owner är låst till sin egen sajt. Superadmin har ingen tenant-bindning och
  // måste peka ut vilken kundvy som ska visas — annars finns inget att rendera.
  const businessId = session.role === "owner" ? user?.businessId : Number(sp.sitio);
  if (!businessId || !Number.isInteger(businessId)) {
    if (session.role === "superadmin") {
      return (
        <div className="panel-wrap">
          <h1>Mi sitio</h1>
          <p>
            Du är inloggad som superadmin. Lägg till <code>?sitio=&lt;id&gt;</code> för att se en kunds vy.
          </p>
        </div>
      );
    }
    redirect("/mi-sitio/login");
  }

  await assertBusinessAccess(businessId);
  const business = await getBusinessById(businessId);
  if (!business) redirect("/mi-sitio/login");

  const [analytics, mediaRows, modules] = await Promise.all([
    getBusinessAnalytics(businessId),
    db
      .select()
      .from(media)
      .where(and(eq(media.businessId, businessId), inArray(media.kind, ["photo", "logo"])))
      .orderBy(asc(media.sortOrder), asc(media.id)),
    db
      .select({ moduleKey: businessModules.moduleKey })
      .from(businessModules)
      .where(and(eq(businessModules.businessId, businessId), eq(businessModules.isEnabled, true))),
  ]);

  const photos = mediaRows
    .filter((m) => m.kind === "photo")
    .map((m) => ({ id: m.id, url: `/media/${businessId}/${smallestVariant(m.variantsJson ?? {}) ?? ""}` }));
  const logo = mediaRows.find((m) => m.kind === "logo");
  const logoUrl = logo ? `/media/${businessId}/${smallestVariant(logo.variantsJson ?? {}) ?? ""}` : null;

  const hasGallery = modules.some((m) => m.moduleKey === "gallery");
  const socials = business.socialsJson ?? {};
  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];
  const liveUrl = absoluteUrl(`/${business.slug}`);

  return (
    <div className="panel-wrap">
      <div className="panel-top">
        <span className="site">{business.name}</span>
        {business.status === "published" ? (
          <a href={liveUrl} target="_blank" rel="noreferrer">
            Ver mi página →
          </a>
        ) : (
          <span className="hint">Tu página todavía no está publicada.</span>
        )}
        <form action={ownerLogoutAction}>
          <button type="submit">Salir</button>
        </form>
      </div>

      <h1>Mi sitio</h1>
      <p>
        Acá cambiás lo que dice tu página. El diseño y el enlace los manejamos nosotros — vos ocupate del
        contenido. Tu WhatsApp es {displayPhone(business.whatsappPhone)}.
      </p>

      <OwnerStats analytics={analytics} />

      <OwnerPhotos
        photos={photos}
        logoUrl={logoUrl}
        heroMediaId={business.heroMediaId}
        maxPhotos={hasGallery ? MAX_PHOTOS_GALLERY : MAX_PHOTOS_BASE}
        setHero={ownerSetHeroAction}
        deletePhoto={ownerDeletePhotoAction}
      />

      <OwnerEditForm
        action={updateOwnerBusinessAction}
        defaults={{
          name: business.name,
          description: business.description ?? "",
          address: business.address ?? "",
          zone: business.zone ?? "",
          city: business.city,
          secondaryPhone: business.secondaryPhone ?? "",
          mapsUrl: business.mapsUrl ?? "",
          instagram: socials.instagram ?? "",
          facebook: socials.facebook ?? "",
          tiktok: socials.tiktok ?? "",
          services,
          hours: business.hoursJson ?? {},
        }}
      />
    </div>
  );
}
