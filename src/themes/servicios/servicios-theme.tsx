import { waLink } from "@/lib/format";
import { openState } from "@/lib/hours";
import { SiteHero } from "@/components/site/hero";
import { SiteClosing, SitePhotos, SiteServices, SiteWhereWhen, WaDock } from "@/components/site/blocks";
import { SiteMenu } from "@/components/site/menu-section";
import { SiteProducts } from "@/components/site/products-section";
import type { ThemeProps } from "../types";

/**
 * Tema `servicios` — TALLER. Ljus stålgrå bas, hårda kanter (radie 2/4/6),
 * en signalfärg, diagonal varningsrastrering i monogram och avslutsband.
 * Variant 1 (ámbar) är låst till kategorin `taller`, variant 2 (azul) till
 * `servicios` (plan §1.11).
 *
 * Blockordning — tjänsten är det som säljs, så den kommer först och foton
 * sist. En kund som söker "electricista Villa Aurelia" vill läsa vad de gör,
 * inte se ett galleri.
 *
 *   hero → servicios → [precios] → [catálogo] → trabajos → dónde → cierre
 *
 * Alla block ligger i src/components/site/blocks.tsx och är gemensamma för
 * de fyra temana; det här filen bestämmer ordning, text och CSS.
 */
export function ServiciosTheme({ business, photos, logo, hero, modules, menu, products, pages }: ThemeProps) {
  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];
  const status = openState(business.hoursJson);

  const waMessage = `Hola ${business.name}, vi su página y quiero consultar por un presupuesto.`;
  const wa = waLink(business.whatsappPhone, waMessage);

  // Hero-bilden visas redan överst; att upprepa den i galleriet får sajten
  // att se ut som om kunden bara hade ett foto.
  const rest = photos.filter((p) => p.id !== hero?.id);
  const rail = modules.has("gallery") ? rest : rest.slice(0, 6);

  const chips = [
    "Presupuesto sin cargo",
    services.length >= 3 ? `${services.length} servicios` : "",
    business.ruc ? `RUC ${business.ruc}` : "",
  ].filter(Boolean);

  return (
    <div className="site-root t-servicios">
      <SiteHero
        business={business}
        pages={pages}
        hero={hero}
        logo={logo}
        status={status}
        wa={wa}
        ctaLabel="Pedir presupuesto"
        eyebrow={business.zone ? `${business.zone}, ${business.city}` : business.city}
        chips={chips}
      />

      <main>
        <SiteServices
          services={services}
          eyebrow="Servicios"
          title="Lo que hacemos"
          wa={wa}
          askTitle="¿No ves lo que buscás?"
          askBody="Contanos qué necesitás. Si lo hacemos, te pasamos precio hoy mismo."
          askCta="Preguntar por WhatsApp"
          evLoc="servicios"
        />

        {/* `servicios` säljer inte rätter utan tjänster till pris, så
            menu-modulen får rubriken "Precios" — samma data, ärlig rubrik. */}
        <SiteMenu
          menu={menu}
          eyebrow="Precios"
          title="Lo que cuesta"
          intro="Precios de referencia en guaraníes. Escribinos y te pasamos el presupuesto exacto."
        />

        <SiteProducts
          products={products}
          eyebrow="Catálogo"
          title="Repuestos y materiales"
          intro="Lo que tenemos en el taller. Consultanos por lo que no esté en la lista."
        />

        <SitePhotos business={business} photos={rail} eyebrow="Trabajos" title="Trabajos hechos" />

        <SiteWhereWhen
          business={business}
          status={status}
          eyebrow="Dónde y cuándo"
          title="Zona de trabajo y horario"
          noHoursNote="Escribinos por WhatsApp y coordinamos día y horario."
        />
      </main>

      <SiteClosing
        business={business}
        booking={modules.has("booking")}
        wa={wa}
        statement="¿Lo arreglamos esta semana?"
        ctaTitle="Escribinos por WhatsApp"
        ctaBody="Contanos qué necesitás y te respondemos con un presupuesto."
        ctaLabel="Pedir presupuesto"
      />

      <WaDock wa={wa} label="Pedir presupuesto" />
    </div>
  );
}
