import { waLink } from "@/lib/format";
import { openState } from "@/lib/hours";
import { SiteHero } from "@/components/site/hero";
import { SiteClosing, SitePhotos, SiteServices, SiteWhereWhen, WaDock } from "@/components/site/blocks";
import { SiteMenu } from "@/components/site/menu-section";
import { SiteProducts } from "@/components/site/products-section";
import type { ThemeProps } from "../types";

/**
 * Tema `comercio` — MERCADO. Pappersvit, nästan neutral bas, måttliga radier
 * (6/10/14), prickraster i monogrammet. Temat är avsiktligt det tystaste av
 * de fyra: en butik har egna produktbilder och egna färger, och sajten ska
 * inte konkurrera med dem.
 *
 * Blockordning — katalogen först: en besökare i en butikssajt letar efter
 * "har ni X, vad kostar det". Variant 1 (carmín) är låst till `comercio`,
 * variant 2 (verde) till `otro` (plan §1.11); `otro` är fallback-branschen,
 * och det här är den mest neutrala sidan vi har.
 *
 *   hero → catálogo → rubros → el local → [lista de precios] → dónde → cierre
 */
export function ComercioTheme({ business, photos, logo, hero, modules, menu, products }: ThemeProps) {
  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];
  const status = openState(business.hoursJson);

  const waMessage = `Hola ${business.name}, vi su página y quiero consultar por un producto.`;
  const wa = waLink(business.whatsappPhone, waMessage);

  const rest = photos.filter((p) => p.id !== hero?.id);
  const rail = modules.has("gallery") ? rest : rest.slice(0, 6);

  const chips = [
    "Consultá stock por WhatsApp",
    services.length >= 3 ? `${services.length} rubros` : "",
    business.ruc ? `RUC ${business.ruc}` : "",
  ].filter(Boolean);

  return (
    <div className="site-root t-comercio">
      <SiteHero
        business={business}
        hero={hero}
        logo={logo}
        status={status}
        wa={wa}
        ctaLabel="Consultar precio"
        eyebrow={business.zone ? `${business.zone}, ${business.city}` : business.city}
        chips={chips}
      />

      <SiteProducts
        products={products}
        eyebrow="Catálogo"
        title="Nuestro catálogo"
        intro="Precios en guaraníes. Consultanos por WhatsApp si buscás algo que no está acá."
      />

      <SiteServices
        services={services}
        eyebrow="Rubros"
        title="Lo que tenemos"
        wa={wa}
        askTitle="¿Buscás algo puntual?"
        askBody="Pasanos el nombre o la marca. Si no lo tenemos, te decimos para cuándo lo conseguimos."
        askCta="Consultar stock"
        evLoc="productos"
      />

      <SitePhotos business={business} photos={rail} eyebrow="El local" title="Así es el local" />

      <SiteMenu
        menu={menu}
        eyebrow="Precios"
        title="Lista de precios"
        intro="Precios en guaraníes. Consultanos por WhatsApp si buscás algo que no está acá."
      />

      <SiteWhereWhen
        business={business}
        status={status}
        eyebrow="Dónde y cuándo"
        title="Dónde estamos"
        noHoursNote="Escribinos por WhatsApp y te decimos si estamos abiertos."
      />

      <SiteClosing
        business={business}
        wa={wa}
        statement="¿Te lo guardamos?"
        ctaTitle="Consultanos por WhatsApp"
        ctaBody="Decinos qué buscás y te confirmamos stock y precio."
        ctaLabel="Consultar precio"
      />

      <WaDock wa={wa} label="Consultar precio" />
    </div>
  );
}
