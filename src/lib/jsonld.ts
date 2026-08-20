import type { Business } from "@/db/schema";
import { openingHoursSpecification } from "./hours";
import { absoluteUrl } from "./env";

/** Bransch → schema.org-subtyp. Fel subtyp är värre än ingen subtyp. */
const SCHEMA_TYPE: Record<string, string> = {
  comercio: "Store",
  servicios: "HomeAndConstructionBusiness",
  gastronomia: "Restaurant",
  salud: "MedicalClinic",
  belleza: "HealthAndBeautyBusiness",
  taller: "AutoRepair",
  otro: "LocalBusiness",
};

export function localBusinessJsonLd(params: {
  business: Business;
  imageUrls: string[];
}): Record<string, unknown> {
  const { business, imageUrls } = params;

  const sameAs = Object.values(business.socialsJson ?? {}).filter(Boolean) as string[];
  const hours = openingHoursSpecification(business.hoursJson);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[business.category] ?? "LocalBusiness",
    "@id": absoluteUrl(`/${business.slug}#business`),
    name: business.name,
    url: absoluteUrl(`/${business.slug}`),
    telephone: business.whatsappPhone,
    description: business.seoDescription ?? business.description ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address ?? undefined,
      addressLocality: business.city,
      addressRegion: business.zone ?? undefined,
      addressCountry: "PY",
    },
    areaServed: [business.zone, business.city].filter(Boolean),
  };

  if (imageUrls.length > 0) data.image = imageUrls;
  if (sameAs.length > 0) data.sameAs = sameAs;
  if (hours) data.openingHoursSpecification = hours;
  if (business.lat && business.lng) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: business.lat,
      longitude: business.lng,
    };
  }
  if (business.mapsUrl) data.hasMap = business.mapsUrl;

  return data;
}
