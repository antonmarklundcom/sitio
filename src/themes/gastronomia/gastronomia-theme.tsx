import { waLink } from "@/lib/format";
import { groupedHours, openState } from "@/lib/hours";
import { SiteImage, WhatsAppGlyph } from "@/components/site/primitives";
import { SiteMenu } from "@/components/site/menu-section";
import type { ThemeProps } from "../types";

/**
 * Tema `gastronomia` — WARM CRAFT-spåret. Ljus-varm kräm, texturerad, bildtung.
 * Maten är produkten, så temat ger bilden hela första skärmen i stället för
 * en textspalt bredvid en bild (det gör `servicios`).
 *
 * Sektion → mönster (web-design-system layout-patterns):
 *   01 hero            → P6 full-bleed bild + kort som korsar sektionsgränsen
 *   02 trust-ribbon    → P8 full-bleed band (mörkt, grain)
 *   03 nuestra cocina  → P4 editorial two-column
 *   04 especialidades  → P3 staggered-weight grid
 *   05 galería         → P7 sticky-side scroll
 *   06 horario/lugar   → P1 asymmetrisk split 5/7
 *   07 statement CTA   → P9 oversized statement
 *
 * Mönsterkartan är medvetet en annan än `servicios` — två sajter i portföljen
 * får inte dela sektion→mönster-karta (skillens Step 2).
 *
 * Utan hero-bild faller 01 tillbaka på ett textblock på surface-ytan: det
 * full-bleed-krav som QA-gaten ställer bärs då av 02, och överlappet av
 * kontaktkortet, som ligger utanför bildvillkoret.
 */
export function GastronomiaTheme({ business, photos, logo, hero, modules, menu }: ThemeProps) {
  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];
  const hours = groupedHours(business.hoursJson);
  const status = openState(business.hoursJson);
  const socials = business.socialsJson ?? {};

  const place = business.zone ? `${business.zone}, ${business.city}` : business.city;
  const headline = business.seoTitle ?? `${business.name}`;

  // Hero-raden är kort med flit: hela beskrivningen står i sektion 03, och
  // samma stycke två gånger på en sida läser som tunt innehåll.
  const lede = business.seoDescription ?? business.description;
  const waMessage = `Hola ${business.name}, vi su página y quiero hacer un pedido.`;
  const wa = waLink(business.whatsappPhone, waMessage);
  const galleryPhotos = (modules.has("gallery") ? photos : photos.slice(0, 6)).filter(
    (p) => p.id !== hero?.id,
  );

  return (
    <div className="site-root t-gastronomia t-light">
      {/* ---------- 01 HERO — P6 full-bleed bild + överlappande panel ---------- */}
      <header className="wrap gast-topbar">
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
        <span className="gast-wordmark">{business.name}</span>
        <a
          href={`tel:${business.whatsappPhone}`}
          data-ev="phone_click"
          data-ev-loc="header"
          className="btn btn--ghost gast-topbar-call"
        >
          Llamar
        </a>
      </header>

      <section id="inicio" className="gast-hero">
        {/* Bild och rubrik ligger i en egen relativ box — rubriken ska
            positioneras mot bilden, inte mot hela sektionen (annars hamnar
            den ovanpå kontaktpanelen på desktop). */}
        <div className="gast-hero-media">
          {hero?.variantsJson ? (
            <figure className="gast-hero-figure scrim">
              <SiteImage
                businessId={business.id}
                variants={hero.variantsJson}
                alt={hero.altText ?? `Platos de ${business.name} en ${place}`}
                sizes="100vw"
                priority
                width={hero.width}
                height={hero.height}
              />
            </figure>
          ) : (
            <div className="gast-hero-figure gast-hero-figure--plain" aria-hidden="true" />
          )}

          <div className="wrap gast-hero-copy">
            <span className="eyebrow">{place}</span>
            {/* Ingen entré-animation ovanför vecket — det fördröjer LCP. */}
            <h1>{headline}</h1>
            {lede ? <p className="gast-lede">{lede}</p> : null}
          </div>
        </div>

        <div className="wrap">
          <div className="card card--raised gast-order-panel reveal">
            <div>
              <h2 className="gast-order-title">Pedidos y reservas</h2>
              <p>
                Escribinos por WhatsApp y te confirmamos al toque.
                {status ? (status.open ? " Estamos abiertos ahora." : " Te respondemos apenas abrimos.") : ""}
              </p>
            </div>
            <a
              href={wa}
              target="_blank"
              rel="noreferrer noopener"
              data-ev="whatsapp_click"
              data-ev-loc="hero"
              className="btn btn--wa"
            >
              <WhatsAppGlyph />
              Pedir por WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ---------- 02 TRUST-RIBBON — P8 full-bleed, mörkt band ---------- */}
      <div className="gast-ribbon grain">
        <div className="wrap gast-ribbon-inner">
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
          <span>Pedidos por WhatsApp</span>
          {business.ruc ? <span>RUC {business.ruc}</span> : null}
        </div>
      </div>

      {/* ---------- 03 NUESTRA COCINA — P4 editorial two-column ---------- */}
      {business.description ? (
        <section id="nosotros">
          <div className="wrap editorial">
            <div>
              <span className="eyebrow">Nuestra cocina</span>
              <h2>Lo que se come acá</h2>
            </div>
            <div className="editorial-body">
              <p className="gast-body-lead">{business.description}</p>
              {business.address ? (
                <p className="address">
                  {business.address}
                  {business.mapsUrl ? (
                    <>
                      {" · "}
                      <a
                        href={business.mapsUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-ev="map_click"
                        data-ev-loc="nosotros"
                      >
                        Cómo llegar
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- 04 ESPECIALIDADES — P3 staggered-weight grid ---------- */}
      {services.length > 0 ? (
        <section id="especialidades">
          <div className="wrap">
            <span className="eyebrow">Especialidades</span>
            <h2 className="reveal">La carta, en corto</h2>
            <ul className="gast-dishes">
              {services.slice(0, 6).map((service, i) => (
                <li
                  key={`${service.name}-${i}`}
                  className={`card reveal ${
                    i === 0 ? "card--ink gast-dish-lead" : i % 2 === 1 ? "card--hair" : "card--accent"
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
                      data-ev-loc="especialidades"
                      className="gast-dish-link"
                    >
                      Pedir este plato →
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ---------- 04b LA CARTA — menu-modulen ---------- */}
      {/* Ligger efter especialidades och före galleriet: "la carta, en corto"
          är rubrikerna, menyn är hela listan med priser. Utan modulen finns
          bara den korta versionen, och sidan har ingen lucka. */}
      <SiteMenu
        menu={menu}
        title="Nuestra carta"
        intro="Precios en guaraníes. Si algo se terminó por hoy, lo sacamos de acá."
      />

      {/* ---------- 05 GALERÍA — P7 sticky-side scroll ---------- */}
      {galleryPhotos.length > 0 ? (
        <section id="galeria" data-ev-view="gallery_view">
          <div className="wrap gast-gallery">
            <div className="gast-gallery-side">
              <span className="eyebrow">Galería</span>
              <h2>Del local y de la cocina</h2>
              <p>Fotos reales, sacadas acá. Lo que ves es lo que te servimos.</p>
            </div>
            <div className="gast-gallery-list">
              {galleryPhotos.map((photo) => (
                <figure key={photo.id} className="gast-gallery-item reveal">
                  <SiteImage
                    businessId={business.id}
                    variants={photo.variantsJson ?? {}}
                    alt={photo.altText ?? `Plato de ${business.name}`}
                    sizes="(min-width: 1024px) 55vw, 100vw"
                    width={photo.width}
                    height={photo.height}
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- 06 HORARIO Y LUGAR — P1 asymmetrisk split 5/7 ---------- */}
      <section id="horario">
        <div className="wrap gast-hours-split">
          <div>
            <span className="eyebrow">Horario</span>
            <h2>Cuándo estamos</h2>
            {status ? (
              <p className="hero-status">
                <span className={status.open ? "dot dot--open" : "dot"} aria-hidden="true" />
                {status.open ? "Abierto ahora" : "Cerrado en este momento"}
              </p>
            ) : null}
          </div>
          <div>
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
            {business.address ? (
              <p className="address">
                {business.address}
                {business.mapsUrl ? (
                  <>
                    {" · "}
                    <a
                      href={business.mapsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      data-ev="map_click"
                      data-ev-loc="horario"
                    >
                      Ver en el mapa
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------- 07 STATEMENT — P9 ---------- */}
      <section id="contacto" className="gast-closing">
        <div className="wrap">
          <p className="statement">
            ¿Reservamos
            <br />
            tu mesa?
          </p>
          <p className="gast-closing-sub">
            Contanos cuántos son y a qué hora. El resto lo arreglamos por WhatsApp.
          </p>
          <a
            href={wa}
            target="_blank"
            rel="noreferrer noopener"
            data-ev="whatsapp_click"
            data-ev-loc="contacto"
            className="btn btn--wa gast-closing-cta"
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
        Hacer un pedido
      </a>
    </div>
  );
}
