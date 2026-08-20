import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/env";
import { localBusinessJsonLd } from "@/lib/jsonld";
import { largestVariant } from "@/lib/media-shared";
import { paletteFor, paletteToCssVars } from "@/themes/palettes";
import { themeComponent } from "@/themes/registry";
import { AnalyticsScript, MotionScript } from "./site-scripts";
import type { SiteData } from "@/db/site-queries";

/**
 * Delad rendering för den publika routen (/[slug], ISR) och preview-routen
 * (/preview/[slug], alltid dynamisk). Uppdelningen finns för att searchParams
 * gör en sida dynamisk — och ISR är hela skalbarhetsstoryn för en enda
 * Node-process på Hostinger.
 */
export function siteMetadata(site: SiteData, opts: { isPreview: boolean }): Metadata {
  const { business } = site;
  const canonical = absoluteUrl(`/${business.slug}`);
  const title =
    business.seoTitle ??
    `${business.name} – ${business.category} en ${business.zone ? `${business.zone}, ` : ""}${business.city}`;
  const description = business.seoDescription ?? business.description?.slice(0, 155) ?? undefined;

  const heroFile = site.hero?.variantsJson ? largestVariant(site.hero.variantsJson) : undefined;
  const ogImage = heroFile ? absoluteUrl(`/media/${business.id}/${heroFile}`) : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    // Ett utkast som råkar indexeras är dyrare att få bort än att aldrig ha
    // funnits — preview är alltid noindex.
    robots: opts.isPreview ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      locale: "es_PY",
      siteName: business.name,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export function RenderSite({ site, isPreview }: { site: SiteData; isPreview: boolean }) {
  const { business, photos, logo, hero, modules } = site;
  const palette = paletteFor(business.themeKey, business.paletteVariant);
  const Theme = themeComponent(business.themeKey);

  const imageUrls = [hero, ...photos]
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => (m.variantsJson ? largestVariant(m.variantsJson) : undefined))
    .filter((file): file is string => Boolean(file))
    .slice(0, 6)
    .map((file) => absoluteUrl(`/media/${business.id}/${file}`));

  const jsonLd = localBusinessJsonLd({ business, imageUrls });

  return (
    <div style={paletteToCssVars(palette) as React.CSSProperties}>
      {isPreview ? (
        <p className="preview-banner">
          Vista previa — {business.status}. Esta página no es visible al público.
        </p>
      ) : null}

      <Theme business={business} photos={photos} logo={logo} hero={hero} modules={new Set(modules)} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MotionScript />
      {/* Preview-besök är dina egna — de ska aldrig räknas i kundens statistik. */}
      {isPreview ? null : <AnalyticsScript businessId={business.id} />}
    </div>
  );
}
