import { formatGs } from "@/lib/format";
import type { ProductRow } from "@/db/product-queries";

/**
 * Produktlistan (products-modulen, PR-14). Delad primitiv: markupen är
 * densamma i alla teman och stilarna ligger i `theme.css`, samma mönster som
 * `SiteMenu`. Varje tema får skruva utseendet med `.t-<tema> .site-products …`.
 *
 * Produkter har inget vy-event i analytics-enumet (plan §1.1: inga
 * migreringar i den här rundan), så sektionen renderar utan `data-ev-view` —
 * till skillnad från menyns `menu_view`.
 */
export function SiteProducts({
  products,
  eyebrow = "Catálogo",
  title,
  intro,
}: {
  products: ProductRow[];
  eyebrow?: string;
  title: string;
  intro?: string;
}) {
  if (products.length === 0) return null;

  return (
    // "catalogo" y no "productos": comercio ya usa id="productos" para su
    // sección de servicios destacados (business.servicesJson), y las dos
    // secciones pueden coexistir en la misma página.
    <section id="catalogo" className="site-products">
      <div className="wrap">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="reveal">{title}</h2>
        {intro ? <p className="site-products-intro">{intro}</p> : null}

        <ul className="site-products-grid">
          {products.map((product) => (
            <li key={product.id} className="site-products-item reveal">
              {product.image ? (
                // Namnet står bredvid — bilden är dekor för skärmläsaren.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="site-products-item-img"
                  src={product.image.src}
                  srcSet={product.image.srcSet}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  width={product.image.width ?? undefined}
                  height={product.image.height ?? undefined}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <div className="site-products-item-head">
                <span className="site-products-item-name">{product.name}</span>
                <span className="site-products-price">{formatGs(product.priceGs)}</span>
              </div>
              {product.description ? <p>{product.description}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
