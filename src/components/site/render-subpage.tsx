import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/env";
import { breadcrumbJsonLd, jsonLdHtml } from "@/lib/jsonld";
import { waLink } from "@/lib/format";
import { openState } from "@/lib/hours";
import { pageDescription, paragraphs } from "@/lib/pages";
import { paletteFor, paletteToCssVars } from "@/themes/palettes";
import { SitePagesNav } from "./hero";
import { SiteClosing, SitePhotos, SiteServices, SiteWhereWhen, WaDock } from "./blocks";
import { SiteMenu } from "./menu-section";
import { SiteProducts } from "./products-section";
import { AnalyticsScript, MotionScript, OpenNowScript } from "./site-scripts";
import { pageLinks } from "./render-site";
import type { SiteData } from "@/db/site-queries";
import type { PageRow } from "@/db/page-queries";

/**
 * En extra sida (extra_pages, R3-25): /[slug]/[page]. Samma temaklass och
 * palett som startsidan, men ett eget enkelt skal — namnet som länk hem,
 * länkraden, titeln, texten — och därefter blocket som sidtypen står för,
 * byggt av samma data som startsidan. Avslutet och WhatsApp-dockan som på
 * startsidan: varje sida ska kunna sluta i en kontakt.
 *
 * Temaoberoende texter (spanska, voseo): temats egna rubriker hör till
 * startsidans berättelse, inte till en undersida.
 */
export function subPageMetadata(site: SiteData, page: PageRow, opts: { isPreview: boolean }): Metadata {
  const { business } = site;
  const canonical = absoluteUrl(`/${business.slug}/${page.pageSlug}`);
  const title = `${page.title} – ${business.name}`;
  const description = pageDescription(page.body) ?? business.seoDescription ?? undefined;
  return {
    title,
    description,
    alternates: { canonical },
    robots: opts.isPreview ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: "website", url: canonical, title, description, locale: "es_PY", siteName: business.name, images: [] },
  };
}

export function RenderSubPage({
  site,
  page,
  isPreview,
  previewToken,
}: {
  site: SiteData;
  page: PageRow;
  isPreview: boolean;
  previewToken?: string;
}) {
  const { business, photos, menu, products } = site;
  const palette = paletteFor(business.themeKey, business.paletteVariant);
  const themeClass = ["servicios", "gastronomia", "comercio", "salud"].includes(business.themeKey)
    ? business.themeKey
    : "servicios";
  const links = pageLinks(site, isPreview ? previewToken : undefined);
  const current = links.find((l) => l.href.split("?")[0] === `/${business.slug}/${page.pageSlug}`)?.href;
  const home = `/${business.slug}${isPreview && previewToken ? `?preview=${previewToken}` : ""}`;
  const wa = waLink(business.whatsappPhone, `Hola ${business.name}, vi su página y quiero hacer una consulta.`);
  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];

  return (
    <div style={paletteToCssVars(palette) as React.CSSProperties}>
      {isPreview ? (
        <p className="preview-banner">
          Vista previa — {business.status}. Esta página no es visible al público.
        </p>
      ) : null}

      <div className={`site-root t-${themeClass}`}>
        <header className="subpage-head">
          <div className="wrap subpage-bar">
            <a href={home} className="subpage-home">
              ← {business.name}
            </a>
          </div>
          <div className="wrap">
            <SitePagesNav pages={links} current={current} />
          </div>
        </header>

        <main>
          <section className="block subpage-body">
            <div className="wrap">
              <span className="eyebrow">{business.city}</span>
              <h1>{page.title}</h1>
              {paragraphs(page.body).map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>
          </section>

          {page.type === "servicios" ? (
            <SiteServices
              services={services}
              eyebrow="Servicios"
              title="Lo que hacemos"
              wa={wa}
              askTitle="¿No encontrás lo que buscás?"
              askBody="Escribinos y te decimos si lo hacemos."
              askCta="Preguntar por WhatsApp"
              evLoc="pagina"
            />
          ) : null}
          {page.type === "galeria" ? (
            <SitePhotos business={business} photos={photos} eyebrow="Fotos" title="Galería" />
          ) : null}
          {page.type === "menu" ? <SiteMenu menu={menu} title="La carta" /> : null}
          {page.type === "productos" ? <SiteProducts products={products} title="Catálogo" /> : null}
          {page.type === "contacto" ? (
            <SiteWhereWhen
              business={business}
              status={openState(business.hoursJson)}
              eyebrow="Contacto"
              title="Dónde y cuándo"
              noHoursNote="Escribinos por WhatsApp y coordinamos."
            />
          ) : null}
        </main>

        <SiteClosing
          business={business}
          booking={site.modules.includes("booking")}
          wa={wa}
          statement={business.name}
          ctaTitle="Escribinos por WhatsApp"
          ctaBody="Te respondemos lo antes posible."
          ctaLabel="Escribir por WhatsApp"
        />
        <WaDock wa={wa} label="Escribir por WhatsApp" />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd({ business, page })) }}
      />
      <MotionScript />
      <OpenNowScript />
      {isPreview ? null : <AnalyticsScript businessId={business.id} />}
    </div>
  );
}
