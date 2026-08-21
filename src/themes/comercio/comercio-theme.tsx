import { waLink } from "@/lib/format";
import { groupedHours, openState } from "@/lib/hours";
import { SiteImage, WhatsAppGlyph } from "@/components/site/primitives";
import { SiteMenu } from "@/components/site/menu-section";
import type { ThemeProps } from "../types";

/**
 * Tema `comercio` — EDITORIAL-spåret. Ljusdominant, platta ytor,
 * hårstrecksramar, generös luft. Kundens produktbilder ska bära färgen, så
 * temat håller sig nästan neutralt och lägger accenten bara på CTA och en
 * highlight per skärm.
 *
 * Sektion → mönster (web-design-system layout-patterns):
 *   01 hero          → P2 offset stack + bildmosaik
 *   02 trust-ribbon  → P8 full-bleed ribbon (ljust, hårstreck)
 *   03 destacados    → P3 staggered-weight grid
 *   04 cómo comprar  → P4 editorial two-column
 *   05 el local      → P6 bleed-image + överlappande panel
 *   06 horario/lugar → P7 sticky-side scroll
 *   07 statement CTA → P9 oversized statement
 *
 * Hero är medvetet INTE P1: den asymmetriska splitten bär redan `servicios`,
 * och två sajter i portföljen får inte dela sektion→mönster-karta.
 */
export function ComercioTheme({ business, photos, logo, hero, modules, menu }: ThemeProps) {
  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];
  const hours = groupedHours(business.hoursJson);
  const status = openState(business.hoursJson);
  const socials = business.socialsJson ?? {};
  const place = business.zone ? `${business.zone}, ${business.city}` : business.city;

  const headline = business.seoTitle ?? `${business.name}`;
  const waMessage = `Hola ${business.name}, vi su página y quiero consultar por un producto.`;
  const wa = waLink(business.whatsappPhone, waMessage);

  // Bilderna delas upp en gång, i ordning, så samma foto aldrig kan hamna i
  // två sektioner: mosaik (0–2), local (3), remsa (4+).
  const ordered = [hero, ...photos.filter((p) => p.id !== hero?.id)].filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );
  const mosaic = ordered.slice(0, 3);
  const localPhoto = ordered[3] ?? null;
  const stripPhotos = ordered.slice(4, modules.has("gallery") ? 20 : 7);

  return (
    <div className="site-root t-comercio t-light">
      {/* ---------- 01 HERO — P2 offset stack + bildmosaik ---------- */}
      <header className="wrap com-topbar">
        {logo?.variantsJson ? (
          <SiteImage
            businessId={business.id}
            variants={logo.variantsJson}
            alt={`${business.name} logo`}
            sizes="120px"
            priority
            className="site-logo"
          />
        ) : null}
        <span className="com-wordmark">{business.name}</span>
        <a
          href={`tel:${business.whatsappPhone}`}
          data-ev="phone_click"
          data-ev-loc="header"
          className="btn btn--ghost com-topbar-call"
        >
          Llamar
        </a>
      </header>

      <section id="inicio" className="com-hero">
        <div className="wrap">
          <div className="com-hero-copy">
            <span className="eyebrow">{place}</span>
            {/* Ingen entré-animation ovanför vecket — det fördröjer LCP. */}
            <h1>{headline}</h1>
            {business.description ? <p className="com-lede">{business.description}</p> : null}
            <div className="com-hero-actions">
              <a
                href={wa}
                target="_blank"
                rel="noreferrer noopener"
                data-ev="whatsapp_click"
                data-ev-loc="hero"
                className="btn btn--primary"
              >
                Consultar por WhatsApp
              </a>
              {business.secondaryPhone ? (
                <a href={`tel:${business.secondaryPhone}`} data-ev="phone_click" data-ev-loc="hero" className="btn btn--ghost">
                  {business.secondaryPhone}
                </a>
              ) : null}
            </div>
          </div>

          {mosaic.length > 0 ? (
            <div className={`com-mosaic com-mosaic--${Math.min(mosaic.length, 3)}`}>
              {mosaic.map((photo, i) => (
                <figure key={photo.id} className="com-mosaic-item">
                  <SiteImage
                    businessId={business.id}
                    variants={photo.variantsJson ?? {}}
                    alt={photo.altText ?? `${business.name} en ${place}`}
                    sizes={i === 0 ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 1024px) 22vw, 50vw"}
                    priority={i === 0}
                    width={photo.width}
                    height={photo.height}
                  />
                </figure>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------- 02 TRUST-RIBBON — P8 full-bleed ---------- */}
      <div className="com-ribbon">
        <div className="wrap com-ribbon-inner">
          <span>
            <strong>{business.city}</strong>
            {business.zone ? ` · ${business.zone}` : ""}
          </span>
          {status ? (
            <span>
              <span className={status.open ? "dot dot--open" : "dot"} aria-hidden="true" />
              {status.open
                ? `Abierto ahora · cierra ${status.closesAt}`
                : status.opensAt
                  ? `Cerrado · abre ${status.opensDay ? `${status.opensDay} ` : ""}${status.opensAt}`
                  : "Consultanos el horario"}
            </span>
          ) : null}
          <span>Consultas por WhatsApp</span>
          {business.ruc ? <span>RUC {business.ruc}</span> : null}
        </div>
      </div>

      {/* ---------- 03 DESTACADOS — P3 staggered-weight grid ---------- */}
      {services.length > 0 ? (
        <section id="productos">
          <div className="wrap">
            <span className="eyebrow">Lo que tenemos</span>
            <h2 className="reveal">Destacados del local</h2>
            <ul className="com-items">
              {services.slice(0, 6).map((service, i) => (
                <li
                  key={`${service.name}-${i}`}
                  className={`card reveal ${
                    i === 0 ? "card--ink com-item-lead" : i % 2 === 1 ? "card--hair" : "card--accent"
                  }`}
                >
                  <h3>{service.name}</h3>
                  {service.desc ? <p>{service.desc}</p> : null}
                  {i === 0 ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer noopener"
                      data-ev="whatsapp_click"
                      data-ev-loc="productos"
                      className="com-item-link"
                    >
                      Consultar precio →
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="com-items-note">
              ¿Buscás algo que no está en la lista? Escribinos y te decimos si lo tenemos.
            </p>
          </div>
        </section>
      ) : null}

      {/* ---------- 04 CÓMO COMPRAR — P4 editorial two-column ---------- */}
      {/* Menu-modulen. I comercio är den en prislista — `products` (PR-14) blir
          den riktiga produktkatalogen; tills dess är det här fallbacken. */}
      <SiteMenu
        menu={menu}
        eyebrow="Precios"
        title="Nuestra lista"
        intro="Precios en guaraníes. Consultanos por WhatsApp si buscás algo que no está acá."
      />

      <section id="como-comprar">
        <div className="wrap editorial">
          <div>
            <span className="eyebrow">Cómo comprar</span>
            <h2>Simple, por WhatsApp</h2>
          </div>
          <div className="editorial-body">
            <ol className="com-steps">
              <li>
                <strong>Escribinos.</strong> Contanos qué buscás. Te confirmamos si está disponible y a qué precio.
              </li>
              <li>
                <strong>Reservamos.</strong> Te lo guardamos hasta que pases, o coordinamos el envío.
              </li>
              <li>
                <strong>Pagás como te queda cómodo.</strong> Efectivo, transferencia o billetera electrónica.
              </li>
            </ol>
            <a
              href={wa}
              target="_blank"
              rel="noreferrer noopener"
              data-ev="whatsapp_click"
              data-ev-loc="como_comprar"
              className="com-inline-link"
            >
              Empezar por WhatsApp →
            </a>
          </div>
        </div>
      </section>

      {/* ---------- 05 EL LOCAL — P6 bleed-image + överlappande panel ---------- */}
      <section id="local" className="com-local">
        {localPhoto?.variantsJson ? (
          <figure className="com-local-figure scrim">
            <SiteImage
              businessId={business.id}
              variants={localPhoto.variantsJson}
              alt={localPhoto.altText ?? `Local de ${business.name} en ${place}`}
              sizes="100vw"
              width={localPhoto.width}
              height={localPhoto.height}
            />
          </figure>
        ) : (
          <div className="com-local-figure com-local-figure--plain" aria-hidden="true" />
        )}
        <div className="wrap">
          <div className="card card--raised com-local-panel reveal">
            <div>
              <h2 className="com-local-title">Pasá por el local</h2>
              <p>
                {business.address
                  ? `${business.address} — ${place}.`
                  : `Estamos en ${place}. Escribinos y te pasamos la ubicación exacta.`}
              </p>
            </div>
            {business.mapsUrl ? (
              <a
                href={business.mapsUrl}
                target="_blank"
                rel="noreferrer noopener"
                data-ev="map_click"
                data-ev-loc="local"
                className="btn btn--primary"
              >
                Ver en el mapa
              </a>
            ) : (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer noopener"
                data-ev="whatsapp_click"
                data-ev-loc="local"
                className="btn btn--wa"
              >
                <WhatsAppGlyph />
                Pedir ubicación
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ---------- 06 HORARIO + GALERÍA — P7 sticky-side scroll ---------- */}
      <section id="horario">
        <div className="wrap com-sticky">
          <div className="com-sticky-side">
            <span className="eyebrow">Horario</span>
            <h2>Cuándo abrimos</h2>
            {status ? (
              <p className="hero-status">
                <span className={status.open ? "dot dot--open" : "dot"} aria-hidden="true" />
                {status.open ? "Abierto ahora" : "Cerrado en este momento"}
              </p>
            ) : null}
          </div>
          <div className="com-sticky-body">
            {hours.length > 0 ? (
              <dl className="hours-list">
                {hours.map((row) => (
                  <div key={row.days} className="hours-row">
                    <dt>{row.days}</dt>
                    <dd>
                      {row.intervals ? row.intervals.map((i) => `${i.open}–${i.close}`).join(" · ") : "Cerrado"}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>Consultanos el horario por WhatsApp — te respondemos el mismo día.</p>
            )}

            {stripPhotos.length > 0 ? (
              <div className="com-strip">
                {stripPhotos.map((photo) => (
                  <figure key={photo.id} className="com-strip-item">
                    <SiteImage
                      businessId={business.id}
                      variants={photo.variantsJson ?? {}}
                      alt={photo.altText ?? `Productos de ${business.name}`}
                      sizes="(min-width: 1024px) 30vw, 70vw"
                      width={photo.width}
                      height={photo.height}
                    />
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------- 07 STATEMENT — P9 ---------- */}
      <section id="contacto" className="com-closing">
        <div className="wrap">
          <p className="statement">
            ¿Te lo
            <br />
            guardamos?
          </p>
          <p className="com-closing-sub">
            Escribinos el nombre del producto y te respondemos con precio y disponibilidad.
          </p>
          <a
            href={wa}
            target="_blank"
            rel="noreferrer noopener"
            data-ev="whatsapp_click"
            data-ev-loc="contacto"
            className="btn btn--wa com-closing-cta"
          >
            <WhatsAppGlyph />
            {business.whatsappPhone}
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <span>
            © {new Date().getFullYear()} {business.name}
            {business.ruc ? ` · RUC ${business.ruc}` : ""}
          </span>
          {Object.keys(socials).length > 0 ? (
            <span className="footer-socials">
              {socials.instagram ? (
                <a href={socials.instagram} target="_blank" rel="noreferrer noopener" data-ev="social_click" data-ev-loc="footer">
                  Instagram
                </a>
              ) : null}
              {socials.facebook ? (
                <a href={socials.facebook} target="_blank" rel="noreferrer noopener" data-ev="social_click" data-ev-loc="footer">
                  Facebook
                </a>
              ) : null}
              {socials.tiktok ? (
                <a href={socials.tiktok} target="_blank" rel="noreferrer noopener" data-ev="social_click" data-ev-loc="footer">
                  TikTok
                </a>
              ) : null}
            </span>
          ) : null}
        </div>
      </footer>

      <a
        href={wa}
        target="_blank"
        rel="noreferrer noopener"
        data-ev="whatsapp_click"
        data-ev-loc="dock"
        className="btn btn--wa wa-dock"
      >
        <WhatsAppGlyph />
        Consultar precio
      </a>
    </div>
  );
}
