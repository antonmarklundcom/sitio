import { waLink } from "@/lib/format";
import { groupedHours, openState } from "@/lib/hours";
import { SiteImage, WhatsAppGlyph } from "@/components/site/primitives";
import { SiteMenu } from "@/components/site/menu-section";
import { SiteProducts } from "@/components/site/products-section";
import type { ThemeProps } from "../types";

/**
 * Tema `salud` — CALM, APPOINTMENT-FIRST. Ljus, sval-neutral bas med en svag
 * blågrön ton; en enda djup accent som bara lever på WhatsApp-CTA:n,
 * "Abierto ahora"-statusen och länkunderstreck. Serverar `salud` (klinik,
 * tandläkare, consultorio) och `belleza` (salong, barberare, estética) —
 * båda "turno"-verksamheter som lever på att synas som nåbara, inte på
 * dekor. Ingen grain, inga dekorativa former eller gradienter.
 *
 * Sektion → mönster (web-design-system layout-patterns), medvetet en annan
 * ordning än `servicios`/`gastronomia`/`comercio` — fotoblocket kommer
 * direkt efter hero (i stället för åttonde), och trust-ribbon ligger sent
 * (i stället för näst först):
 *   01 hero            → P1 asymmetrisk split — text mot ett schema-/statuskort,
 *                         ingen bild i själva hero-splitten
 *   02 fotos           → P6 bildrutnät direkt efter hero (bildledd, som ett
 *                         salongsgalleri, utan ett andra tema)
 *   03 servicios       → P3 staggered-weight grid
 *   (meny, villkorad)  → delad primitiv, "Precios de turno"
 *   04 cómo llegar     → P4 editorial two-column
 *   05 trust-ribbon    → P8 full-bleed ("Turnos por WhatsApp")
 *   06 statement CTA   → P9 oversized statement + kontaktpanel
 *
 * Återhållsamhetsregeln: kundens logga, foton och putsade text bär sidan.
 * Accenten lever på högst tre elementtyper (CTA, öppet-status, länkar);
 * hairlines separerar sektioner, inga fyllda paneler.
 */
export function SaludTheme({ business, photos, logo, hero, modules, menu, products }: ThemeProps) {
  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];
  const hours = groupedHours(business.hoursJson);
  const status = openState(business.hoursJson);
  const socials = business.socialsJson ?? {};
  const place = business.zone ? `${business.zone}, ${business.city}` : business.city;

  const headline = business.seoTitle ?? `${business.name} en ${place}`;
  const waMessage = `Hola ${business.name}, vi su página y quiero consultar por un turno.`;
  const wa = waLink(business.whatsappPhone, waMessage);

  // Hero-bilden är en av fotoblockets bilder, inte en egen — dupliceras inte.
  const ordered = [hero, ...photos.filter((p) => p.id !== hero?.id)].filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );
  const galleryPhotos = modules.has("gallery") ? ordered : ordered.slice(0, 6);

  return (
    <div className="site-root t-salud t-light">
      {/* ---------- topbar ---------- */}
      <header className="wrap sal-topbar">
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
        <span className="sal-wordmark">{business.name}</span>
        <a
          href={`tel:${business.whatsappPhone}`}
          data-ev="phone_click"
          data-ev-loc="header"
          className="btn btn--ghost sal-topbar-call"
        >
          Llamar
        </a>
      </header>

      {/* ---------- 01 HERO — P1 split: texto vs. tarjeta de horario ---------- */}
      <section id="inicio" className="sal-hero">
        <div className="wrap sal-hero-grid">
          <div className="sal-hero-copy">
            <span className="eyebrow">{place}</span>
            {/* Ingen entré-animation ovanför vecket — det fördröjer LCP. */}
            <h1>{headline}</h1>
            {business.description ? <p className="sal-lede">{business.description}</p> : null}
            <div className="sal-hero-actions">
              <a
                href={wa}
                target="_blank"
                rel="noreferrer noopener"
                data-ev="whatsapp_click"
                data-ev-loc="hero"
                className="btn btn--primary"
              >
                Reservar turno por WhatsApp
              </a>
              {business.secondaryPhone ? (
                <a href={`tel:${business.secondaryPhone}`} data-ev="phone_click" data-ev-loc="hero" className="btn btn--ghost">
                  {business.secondaryPhone}
                </a>
              ) : null}
            </div>
          </div>

          <div className="card card--raised sal-schedule-card reveal">
            <span className="eyebrow">Horario</span>
            {status ? (
              <p className="hero-status">
                <span className={status.open ? "dot dot--open" : "dot"} aria-hidden="true" />
                {status.open
                  ? `Abierto ahora · cierra ${status.closesAt}`
                  : status.opensAt
                    ? `Cerrado ahora · abre ${status.opensDay ? `${status.opensDay} ` : ""}${status.opensAt}`
                    : "Consultanos el horario por WhatsApp"}
              </p>
            ) : null}
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
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------- 02 FOTOS — P6 bildrutnät, direkt efter hero ---------- */}
      {galleryPhotos.length > 0 ? (
        <section id="fotos" data-ev-view="gallery_view" className="sal-photos">
          <div className="sal-photo-grid">
            {galleryPhotos.map((photo, i) => (
              <figure key={photo.id} className="sal-photo-item">
                <SiteImage
                  businessId={business.id}
                  variants={photo.variantsJson ?? {}}
                  alt={photo.altText ?? `${business.name} en ${place}`}
                  sizes="(min-width: 1024px) 30vw, 50vw"
                  priority={i === 0}
                  width={photo.width}
                  height={photo.height}
                />
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------- 03 SERVICIOS — P3 staggered-weight grid ---------- */}
      {services.length > 0 ? (
        <section id="servicios">
          <div className="wrap">
            <span className="eyebrow">Servicios</span>
            <h2 className="reveal">Cómo te podemos ayudar</h2>
            <ul className="sal-services-grid">
              {services.map((service, i) => (
                <li
                  key={`${service.name}-${i}`}
                  className={`card reveal ${
                    i === 0 ? "card--ink sal-service-lead" : i % 2 === 1 ? "card--hair" : "card--accent"
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
                      data-ev-loc="servicios"
                      className="sal-service-link"
                    >
                      Consultar disponibilidad →
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Menu-modulen. En "turno"-verksamhet tar betalt per konsultation/session,
          så det blir en referensprislista — samma delade primitiv som i de
          andra temana. */}
      <SiteMenu
        menu={menu}
        eyebrow="Precios"
        title="Precios de turno"
        intro="Precios de referencia en guaraníes. Confirmamos el valor exacto al coordinar el turno."
      />

      {/* Products-modulen (§6.4, S6): delad primitiv, byggd av S1. */}
      <SiteProducts products={products} eyebrow="Productos" title="Productos que usamos" />

      {/* ---------- 04 CÓMO LLEGAR — P4 editorial two-column ---------- */}
      <section id="como-llegar">
        <div className="wrap editorial">
          <div>
            <span className="eyebrow">Dónde estamos</span>
            <h2>Cómo llegar</h2>
          </div>
          <div className="editorial-body">
            <p>
              Atendemos en <strong style={{ color: "var(--ink)" }}>{place}</strong>
              {business.address ? `, ${business.address}` : ""}.
            </p>
            {business.mapsUrl ? (
              <a
                href={business.mapsUrl}
                target="_blank"
                rel="noreferrer noopener"
                data-ev="map_click"
                data-ev-loc="como_llegar"
                className="sal-inline-link"
              >
                Ver en el mapa →
              </a>
            ) : (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer noopener"
                data-ev="whatsapp_click"
                data-ev-loc="como_llegar"
                className="sal-inline-link"
              >
                Pedir la ubicación por WhatsApp →
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ---------- 05 TRUST-RIBBON — P8 full-bleed ---------- */}
      <div className="sal-ribbon">
        <div className="wrap sal-ribbon-inner">
          <span>
            <strong>{business.city}</strong>
            {business.zone ? ` · ${business.zone}` : ""}
          </span>
          <span>Turnos por WhatsApp</span>
          {status ? <span>{status.open ? "Abierto ahora" : "Respondemos el mismo día"}</span> : null}
          {business.ruc ? <span>RUC {business.ruc}</span> : null}
        </div>
      </div>

      {/* ---------- 06 STATEMENT CTA — P9 ---------- */}
      <section id="contacto" className="sal-closing">
        <div className="wrap">
          <p className="statement">
            ¿Coordinamos
            <br />
            tu turno?
          </p>
          <div className="card card--raised sal-contact-panel reveal">
            <div>
              <h3 style={{ marginBottom: "var(--s-2)" }}>Escribinos por WhatsApp</h3>
              <p style={{ marginBottom: 0 }}>Contanos qué necesitás y coordinamos día y horario.</p>
            </div>
            <a
              href={wa}
              target="_blank"
              rel="noreferrer noopener"
              data-ev="whatsapp_click"
              data-ev-loc="contacto"
              className="btn btn--wa"
            >
              <WhatsAppGlyph />
              {business.whatsappPhone}
            </a>
          </div>
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

      {/* Sticky WhatsApp-CTA — hela produktens konverteringspunkt. */}
      <a
        href={wa}
        target="_blank"
        rel="noreferrer noopener"
        data-ev="whatsapp_click"
        data-ev-loc="dock"
        className="btn btn--wa wa-dock"
      >
        <WhatsAppGlyph />
        Reservar turno
      </a>
    </div>
  );
}
