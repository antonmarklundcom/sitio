import { waLink } from "@/lib/format";
import { openState } from "@/lib/hours";
import { SiteHero } from "@/components/site/hero";
import { SiteClosing, SitePhotos, SiteServices, SiteWhereWhen, WaDock } from "@/components/site/blocks";
import { SiteMenu } from "@/components/site/menu-section";
import { SiteProducts } from "@/components/site/products-section";
import type { ThemeProps } from "../types";

/**
 * Tema `salud` — CALMA. Blekt blågrön (v1) respektive svagt rosa (v2) bas,
 * mjukaste radierna (14/22/32), inga hårda linjer och ingen textur utöver ett
 * mjukt bågmönster i monogrammet. Foton tonas ner en aning: en klinik- eller
 * salongsbild tagen med telefon blir lugnare av lägre mättnad.
 *
 * Blockordning — verksamheter som säljer TURNOS: efter behandlingarna kommer
 * "dónde y cuándo" direkt, för det är frågan som avgör om besökaren skriver.
 * Variant 1 (petróleo) är låst till `salud`, variant 2 (orquídea) till
 * `belleza` (plan §1.11 och §1.12: belleza är ingen egen temanyckel).
 *
 *   hero → tratamientos → dónde y cuándo → el lugar → [precios] → [productos] → cierre
 */
export function SaludTheme({ business, photos, logo, hero, modules, menu, products }: ThemeProps) {
  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];
  const status = openState(business.hoursJson);

  const waMessage = `Hola ${business.name}, vi su página y quiero pedir un turno.`;
  const wa = waLink(business.whatsappPhone, waMessage);

  const rest = photos.filter((p) => p.id !== hero?.id);
  const rail = modules.has("gallery") ? rest : rest.slice(0, 6);

  const chips = [
    "Turnos por WhatsApp",
    services.length >= 3 ? `${services.length} tratamientos` : "",
    business.ruc ? `RUC ${business.ruc}` : "",
  ].filter(Boolean);

  return (
    <div className="site-root t-salud">
      <SiteHero
        business={business}
        hero={hero}
        logo={logo}
        status={status}
        wa={wa}
        ctaLabel="Pedir un turno"
        eyebrow={business.zone ? `${business.zone}, ${business.city}` : business.city}
        chips={chips}
      />

      <SiteServices
        services={services}
        eyebrow="Tratamientos"
        title="Lo que atendemos"
        wa={wa}
        askTitle="¿No estás seguro de qué necesitás?"
        askBody="Contanos qué te pasa y te decimos qué turno te conviene pedir."
        askCta="Preguntar por WhatsApp"
        evLoc="servicios"
      />

      <SiteWhereWhen
        business={business}
        status={status}
        eyebrow="Turnos"
        title="Dónde y cuándo atendemos"
        noHoursNote="Escribinos por WhatsApp y coordinamos el turno."
      />

      <SitePhotos business={business} photos={rail} eyebrow="El lugar" title="Dónde te atendemos" />

      <SiteMenu
        menu={menu}
        eyebrow="Precios"
        title="Precios de referencia"
        intro="Precios de referencia en guaraníes. Confirmamos el valor exacto al coordinar el turno."
      />

      <SiteProducts
        products={products}
        eyebrow="Productos"
        title="Productos que usamos"
        intro="Lo que también vendemos en el consultorio, en guaraníes."
      />

      <SiteClosing
        business={business}
        wa={wa}
        statement="Pedí tu turno hoy."
        ctaTitle="Pedí tu turno por WhatsApp"
        ctaBody="Decinos qué necesitás y qué día te queda cómodo."
        ctaLabel="Pedir un turno"
      />

      <WaDock wa={wa} label="Pedir un turno" />
    </div>
  );
}
