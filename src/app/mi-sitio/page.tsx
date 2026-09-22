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
import { smallestVariant } from "@/lib/media-shared";
import { enabledModules, photoLimitFor } from "@/db/module-queries";
import { getMenu } from "@/db/menu-queries";
import { getProducts } from "@/db/product-queries";
import { OwnerMenu } from "@/components/mi-sitio/owner-menu";
import { OwnerProducts } from "@/components/mi-sitio/owner-products";
import {
  addSectionAction,
  deleteItemAction,
  deleteSectionAction,
  moveItemAction,
  moveSectionAction,
  removeItemImageAction,
  renameSectionAction,
  saveItemAction,
  toggleItemAvailabilityAction,
} from "./menu-actions";
import {
  deleteProductAction,
  moveProductAction,
  removeProductImageAction,
  saveProductAction,
  toggleProductVisibilityAction,
} from "./product-actions";
import { OwnerEditForm, OwnerPhotos } from "@/components/mi-sitio/owner-forms";
import { OwnerStats } from "@/components/mi-sitio/owner-stats";
import {
  ownerDeletePhotoAction,
  ownerMoveMediaAction,
  ownerSetHeroAction,
  updateOwnerBusinessAction,
} from "./actions";
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

  const [analytics, mediaRows, modules, maxPhotos] = await Promise.all([
    getBusinessAnalytics(businessId),
    db
      .select()
      .from(media)
      .where(and(eq(media.businessId, businessId), inArray(media.kind, ["photo", "logo"])))
      .orderBy(asc(media.sortOrder), asc(media.id)),
    enabledModules(businessId),
    // Samma källa som /api/upload använder, så panelens räknare och ruttens
    // avslag aldrig kan säga olika saker om samma sajt.
    photoLimitFor(businessId),
  ]);

  const photos = mediaRows
    .filter((m) => m.kind === "photo")
    .map((m) => ({ id: m.id, url: `/media/${businessId}/${smallestVariant(m.variantsJson ?? {}) ?? ""}` }));
  const logo = mediaRows.find((m) => m.kind === "logo");
  const logoUrl = logo ? `/media/${businessId}/${smallestVariant(logo.variantsJson ?? {}) ?? ""}` : null;

  const hasGallery = modules.has("gallery");
  // Menyn och produkterna läses först när modulen är på: en avstängd modul
  // ska inte kosta en extra fråga per sidladdning, och datat ligger kvar
  // tills den slås på igen.
  const menu = modules.has("menu") ? await getMenu(businessId) : [];
  const products = modules.has("products") ? await getProducts(businessId) : [];
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
        maxPhotos={maxPhotos}
        hasGallery={hasGallery}
        setHero={ownerSetHeroAction}
        deletePhoto={ownerDeletePhotoAction}
        movePhoto={ownerMoveMediaAction}
      />

      {modules.has("menu") ? (
        <OwnerMenu
          menu={menu}
          addSection={addSectionAction}
          renameSection={renameSectionAction}
          deleteSection={deleteSectionAction}
          moveSection={moveSectionAction}
          saveItem={saveItemAction}
          deleteItem={deleteItemAction}
          toggleAvailability={toggleItemAvailabilityAction}
          moveItem={moveItemAction}
          removeItemImage={removeItemImageAction}
        />
      ) : null}

      {modules.has("products") ? (
        <OwnerProducts
          products={products}
          saveProduct={saveProductAction}
          deleteProduct={deleteProductAction}
          toggleVisibility={toggleProductVisibilityAction}
          moveProduct={moveProductAction}
          removeImage={removeProductImageAction}
        />
      ) : null}

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
