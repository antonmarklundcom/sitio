import { waLink } from "@/lib/format";
import { groupedHours, openState } from "@/lib/hours";
import { SiteImage, WhatsAppGlyph } from "@/components/site/primitives";
import { SiteMenu } from "@/components/site/menu-section";
import type { ThemeProps } from "../types";

/**
 * Tema `servicios` — INDUSTRIAL-spåret. Mörkdominant, hård kant, hög
 * kontrast, stor WhatsApp-CTA. Nästan all paraguayansk trafik är mobil,
 * så allt är designat mobil-först och testat från 360 px.
 *
 * Sektion → mönster (web-design-system layout-patterns):
 *   01 hero          → P1 asymmetrisk split 7/5
 *   02 trust-ribbon  → P8 full-bleed ribbon
 *   03 servicios     → P3 staggered-weight grid
 *   04 proceso       → P5 numbered process rail
 *   05 zonas/horario → P4 editorial two-column
 *   06 galería       → P6 bleed-image overlap (endast med foton)
 *   07 statement CTA → P9 oversized statement + överlappande kontaktpanel
 *
 * Inga två intilliggande sektioner delar mönster. Full-bleed (02), överlapp
 * (kontaktpanelen i 07) och oversized statement (07) finns alltid — de får
 * inte hänga på att kunden har laddat upp foton.
 */
export function ServiciosTheme({ business, photos, logo, hero, modules, menu }: ThemeProps) {
  const services = Array.isArray(business.servicesJson) ? business.servicesJson : [];
  const hours = groupedHours(business.hoursJson);
  const status = openState(business.hoursJson);
  const socials = business.socialsJson ?? {};
  const zones = [business.zone, business.city].filter(Boolean) as string[];

  // h1 härleds deterministiskt. seoTitle är redigerbar i admin och vinner när
  // den finns — men den får aldrig sönderdelas med strängtrick.
  const place = business.zone ? `${business.zone}, ${business.city}` : business.city;
  const headline = business.seoTitle ?? `${business.name} en ${place}`;

  const waMessage = `Hola ${business.name}, vi su página y quiero consultar por un presupuesto.`;
  const wa = waLink(business.whatsappPhone, waMessage);
  const galleryPhotos = modules.has("gallery") ? photos : photos.slice(0, 3);

  return (
    <div className="site-root grain">
      {/* ---------- 01 HERO — P1 asymmetrisk split 7/5 ---------- */}
      <header className="wrap" style={{ paddingBlock: "var(--s-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4)", flexWrap: "wrap" }}>
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
          <span style={{ fontWeight: 600, letterSpacing: "-0.02em", fontSize: "var(--t-1)" }}>{business.name}</span>
          <a
            href={`tel:${business.whatsappPhone}`}
            data-ev="phone_click"
            data-ev-loc="header"
            className="btn btn--ghost"
            style={{ marginInlineStart: "auto", minHeight: 44 }}
          >
            Llamar
          </a>
        </div>
      </header>

      <section id="inicio" style={{ paddingBlockStart: "var(--s-8)" }}>
        <div className={`wrap hero-grid ${hero?.variantsJson ? "hero-grid--split" : "hero-grid--solo"}`}>
          <div className="hero-copy">
            <span className="eyebrow">
              {business.zone ? `${business.zone}, ${business.city}` : business.city}
            </span>
            {/* Ingen entré-animation ovanför vecket — det fördröjer LCP. */}
            <h1>{headline}</h1>
            {business.description ? (
              <p style={{ fontSize: "var(--t-1)", color: "var(--ink)" }}>{business.description}</p>
            ) : null}

            <div className="hero-actions">
              <a href={wa} target="_blank" rel="noreferrer noopener" data-ev="whatsapp_click" data-ev-loc="hero" className="btn btn--primary">
                Pedir presupuesto por WhatsApp
              </a>
              {business.secondaryPhone ? (
                <a href={`tel:${business.secondaryPhone}`} data-ev="phone_click" data-ev-loc="hero" className="btn btn--ghost">
                  {business.secondaryPhone}
                </a>
              ) : null}
            </div>

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
          </div>

          {hero?.variantsJson ? (
            <figure className="hero-figure scrim">
              <SiteImage
                businessId={business.id}
                variants={hero.variantsJson}
                alt={hero.altText ?? `${business.name} en ${business.city}`}
                sizes="(min-width: 1024px) 42vw, 100vw"
                priority
                width={hero.width}
                height={hero.height}
              />
            </figure>
          ) : null}
        </div>
      </section>

      {/* ---------- 02 TRUST-RIBBON — P8 full-bleed ---------- */}
      <div className="ribbon grain">
        <div className="wrap ribbon-inner">
          <span>
            <strong>{business.city}</strong>
            {business.zone ? ` · ${business.zone}` : ""}
          </span>
          {status ? <span>{status.open ? "Abierto ahora" : "Respondemos por WhatsApp"}</span> : null}
          <span>Presupuesto sin cargo</span>
          {business.ruc ? <span>RUC {business.ruc}</span> : null}
        </div>
      </div>

      {/* ---------- 03 SERVICIOS — P3 staggered-weight grid ---------- */}
      {services.length > 0 ? (
        <section id="servicios">
          <div className="wrap">
            <span className="eyebrow">Servicios</span>
            <h2 className="reveal">Lo que hacemos</h2>
            <ul className="services-grid">
              {services.map((service, i) => (
                <li
                  key={`${service.name}-${i}`}
                  className={`card reveal ${
                    i === 0 ? "card--ink services-lead" : i % 2 === 1 ? "card--hair" : "card--accent"
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
                      className="services-lead-link"
                    >
                      Consultar por este servicio →
                    </a>
                  ) : null}
                </li>
              ))}

              {/* Fyller den lucka som span-2-kortet lämnar i gridden, och gör
                  det med innehåll som konverterar i stället för med luft. */}
              <li className="card card--hair services-ask reveal">
                <h3>¿No ves lo que buscás?</h3>
                <p>Contanos qué necesitás. Si lo hacemos, te pasamos precio hoy mismo.</p>
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-ev="whatsapp_click"
                  data-ev-loc="servicios_ask"
                  className="services-ask-link"
                >
                  Preguntar por WhatsApp →
                </a>
              </li>
            </ul>
          </div>
        </section>
      ) : null}

      {/* ---------- 04 PROCESO — P5 numbered process rail ---------- */}
      {/* Menu-modulen. `servicios` säljer inte rätter utan tjänster till pris,
          så rubriken är "Precios" — samma data, ärlig rubrik. Generisk
          fallback så att en kund med modulen på aldrig får en tom sida. */}
      <SiteMenu
        menu={menu}
        eyebrow="Precios"
        title="Lo que cuesta"
        intro="Precios de referencia en guaraníes. Escribinos y te pasamos el presupuesto exacto."
      />

      <section id="proceso">
        <div className="wrap">
          <span className="eyebrow">Cómo trabajamos</span>
          <h2 className="reveal">Tres pasos, sin vueltas</h2>
          <ol className="process-rail">
            {[
              { n: "01", t: "Escribinos", d: "Contanos qué necesitás por WhatsApp. Respondemos con lo que haga falta saber." },
              { n: "02", t: "Presupuesto", d: "Te pasamos el precio y el plazo antes de empezar. Sin sorpresas después." },
              { n: "03", t: "Trabajo hecho", d: "Coordinamos día y horario, y dejamos todo funcionando." },
            ].map((step) => (
              <li key={step.n} className="process-step reveal">
                <span className="process-num" aria-hidden="true">
                  {step.n}
                </span>
                <h3>{step.t}</h3>
                <p>{step.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- 05 ZONAS + HORARIO — P4 editorial two-column ---------- */}
      <section id="horario">
        <div className="wrap editorial">
          <div>
            <span className="eyebrow">Dónde y cuándo</span>
            <h2>Zona de trabajo y horario</h2>
          </div>
          <div className="editorial-body">
            {zones.length > 0 ? (
              <p>
                Atendemos en <strong style={{ color: "var(--ink)" }}>{zones.join(", ")}</strong> y alrededores.
                Si tu barrio no está en la lista, consultanos igual.
              </p>
            ) : null}

            {hours.length > 0 ? (
              <dl className="hours-list">
                {hours.map((row) => (
                  <div key={row.days} className="hours-row">
                    <dt>{row.days}</dt>
                    <dd>
                      {row.intervals
                        ? row.intervals.map((i) => `${i.open}–${i.close}`).join(" · ")
                        : "Cerrado"}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {business.address ? (
              <p className="address">
                {business.address}
                {business.mapsUrl ? (
                  <>
                    {" · "}
                    <a href={business.mapsUrl} target="_blank" rel="noreferrer noopener" data-ev="map_click" data-ev-loc="horario">
                      Ver en el mapa
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------- 06 GALERÍA — P6 bleed-image band ---------- */}
      {galleryPhotos.length > 0 ? (
        <section id="trabajos" data-ev-view="gallery_view" style={{ paddingBlockEnd: 0 }}>
          <div className="wrap">
            <span className="eyebrow">Trabajos</span>
          </div>
          <div className="gallery-band">
            {galleryPhotos.map((photo) => (
              <figure key={photo.id} className="gallery-item">
                <SiteImage
                  businessId={business.id}
                  variants={photo.variantsJson ?? {}}
                  alt={photo.altText ?? `Trabajo de ${business.name}`}
                  sizes="(min-width: 1024px) 33vw, 80vw"
                  width={photo.width}
                  height={photo.height}
                />
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------- 07 STATEMENT + kontaktpanel (överlapp) — P9 ---------- */}
      <section id="contacto" className="closing">
        <div className="wrap">
          <p className="statement">
            ¿Lo arreglamos
            <br />
            esta semana?
          </p>
          <div className="card card--raised contact-panel reveal">
            <div>
              <h3 style={{ marginBottom: "var(--s-2)" }}>Escribinos por WhatsApp</h3>
              <p style={{ marginBottom: 0 }}>
                Contanos qué necesitás y te respondemos con un presupuesto.
              </p>
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
        Pedir presupuesto
      </a>
    </div>
  );
}
