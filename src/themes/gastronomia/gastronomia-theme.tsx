import { waLink } from "@/lib/format";
import { openState } from "@/lib/hours";
import { SiteHero } from "@/components/site/hero";
import { SiteClosing, SitePhotos, SiteServices, SiteWhereWhen, WaDock } from "@/components/site/blocks";
import { SiteMenu } from "@/components/site/menu-section";
import { SiteProducts } from "@/components/site/products-section";
import type { ThemeProps } from "../types";

/**
 * Tema `gastronomia` — COCINA. Krämvit bas, varmare radier (10/18/26), grain
 * på det mörka bandet, foton som får en aning extra mättnad. Maten är sidans
 * färg; temat håller sig varmt och tyst omkring den.
 *
 * Blockordning — kartan är det enda besökaren egentligen kom för, så den
 * ligger direkt under hero när modulen är på. Tjänsterna ("especialidades")
 * bär sidan när den inte är det.
 *
 *   hero → carta → especialidades → el local → dónde → [para llevar] → cierre
 */
export function GastronomiaTheme({ business, photos, logo, hero, modules, menu, products, pages }: ThemeProps) {
  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];
  const status = openState(business.hoursJson);

  const waMessage = `Hola ${business.name}, vi su página y quiero hacer un pedido.`;
  const wa = waLink(business.whatsappPhone, waMessage);

  const rest = photos.filter((p) => p.id !== hero?.id);
  const rail = modules.has("gallery") ? rest : rest.slice(0, 6);

  const chips = [
    "Pedidos por WhatsApp",
    services.length >= 3 ? `${services.length} especialidades` : "",
    business.ruc ? `RUC ${business.ruc}` : "",
  ].filter(Boolean);

  return (
    <div className="site-root t-gastronomia">
      <SiteHero
        business={business}
        pages={pages}
        hero={hero}
        logo={logo}
        status={status}
        wa={wa}
        ctaLabel="Hacer un pedido"
        eyebrow={business.zone ? `${business.zone}, ${business.city}` : business.city}
        chips={chips}
      />

      <main>
        <SiteMenu
          menu={menu}
          eyebrow="La carta"
          title="Nuestra carta"
          intro="Precios en guaraníes. Si algo se terminó por hoy, lo sacamos de acá."
        />

        <SiteServices
          services={services}
          eyebrow="La casa"
          title="Lo que sale de la cocina"
          wa={wa}
          askTitle="¿Querés encargar algo?"
          askBody="Viandas, bandejas y pedidos para llevar. Escribinos y lo dejamos listo."
          askCta="Encargar por WhatsApp"
          evLoc="especialidades"
        />

        <SitePhotos business={business} photos={rail} eyebrow="El local" title="Así es acá adentro" />

        <SiteWhereWhen
          business={business}
          status={status}
          eyebrow="Dónde y cuándo"
          title="Dónde estamos"
          noHoursNote="Escribinos por WhatsApp y te decimos si estamos abiertos."
        />

        <SiteProducts
          products={products}
          eyebrow="Para llevar"
          title="Otros productos"
          intro="Lo que también vendemos en el local, en guaraníes."
        />
      </main>

      <SiteClosing
        business={business}
        booking={modules.has("booking")}
        wa={wa}
        statement="¿Qué te servimos hoy?"
        ctaTitle="Pedí por WhatsApp"
        ctaBody="Decinos qué querés y para qué hora, y lo dejamos listo."
        ctaLabel="Hacer un pedido"
      />

      <WaDock wa={wa} label="Hacer un pedido" />
    </div>
  );
}
