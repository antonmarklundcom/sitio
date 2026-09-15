import { FAQS, FEATURES, PRICE_BAND, REGISTRO_CTA, STEPS, TIERS } from "./content";
import { PhoneMock } from "./phone-mock";
import { SalesCta } from "./cta";
import type { SalesContact } from "./sales-contact";

/* ---------- header ---------- */

export function LandingHeader({ contact }: { contact: SalesContact }) {
  return (
    <header className="lp-header">
      <div className="lp-wrap lp-header-inner">
        <span className="lp-brand">sitio<span className="lp-brand-dim">.com.py</span></span>
        <nav className="lp-nav" aria-label="Secciones">
          <a href="#incluye">Qué incluye</a>
          <a href="#como">Cómo funciona</a>
          <a href="#precio">Precio</a>
        </nav>
        <SalesCta contact={contact} variant="ghost" className="lp-header-cta">
          Escribinos
        </SalesCta>
      </div>
    </header>
  );
}

/* ---------- 01 hero: split 7/5 med telefonmock ---------- */

export function LandingHero({ contact }: { contact: SalesContact }) {
  return (
    <section className="lp-hero">
      <div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">Para negocios de Paraguay</span>
          <h1>
            Tu negocio con página propia y el WhatsApp a un toque
          </h1>
          <p className="lp-lede">
            Hacemos una página de una sola pantalla con tus datos, tus fotos y tu
            horario. El cliente la abre desde el celular y te escribe sin buscar
            tu número por ningún lado.
          </p>
          <div className="lp-hero-actions">
            <SalesCta contact={contact}>Pedir la mía por WhatsApp</SalesCta>
            <a href={REGISTRO_CTA.href} className="lp-btn lp-btn--ghost">
              {REGISTRO_CTA.label}
            </a>
          </div>
          <p className="lp-hero-note">
            {PRICE_BAND} · publicada en 48 h · sin dominio ni hosting aparte
          </p>
        </div>
        <PhoneMock />
      </div>
    </section>
  );
}

/* ---------- 02 ribbon ---------- */

export function LandingRibbon() {
  return (
    <div className="lp-ribbon">
      <div className="lp-wrap lp-ribbon-inner">
        <span><strong>Una página</strong> por negocio</span>
        <span><strong>48 h</strong> hasta publicar</span>
        <span><strong>{PRICE_BAND}</strong></span>
      </div>
    </div>
  );
}

/* ---------- 03 qué incluye: bento ---------- */

export function LandingFeatures() {
  return (
    <section id="incluye" className="lp-section">
      <div className="lp-wrap">
        <span className="lp-eyebrow">Qué incluye</span>
        <h2>Todo lo que un cliente busca antes de escribirte</h2>
        <ul className="lp-bento">
          {FEATURES.map((f, i) => (
            <li key={f.title} className={`lp-card${i === 0 ? " lp-card--lead" : ""}`}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 04 cómo funciona: numbered rail ---------- */

export function LandingSteps() {
  return (
    <section id="como" className="lp-section lp-section--alt">
      <div className="lp-wrap">
        <span className="lp-eyebrow">Cómo funciona</span>
        <h2>Tres pasos y la página está en línea</h2>
        <ol className="lp-rail">
          {STEPS.map((s) => (
            <li key={s.n} className="lp-step">
              <span className="lp-step-num" aria-hidden="true">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- 05 precio ---------- */

export function LandingPricing({ contact }: { contact: SalesContact }) {
  return (
    <section id="precio" className="lp-section">
      <div className="lp-wrap">
        <span className="lp-eyebrow">Precio</span>
        <h2>Dos planes, un pago por año</h2>
        <p className="lp-section-lede">
          El rubro no cambia el precio. Podés pasar de Básico a Plus cuando
          quieras y pagás la diferencia, con la misma fecha de vencimiento.
        </p>
        <div className="lp-tiers">
          {TIERS.map((t) => (
            <article key={t.name} className={`lp-tier${t.featured ? " lp-tier--featured" : ""}`}>
              <h3>{t.name}</h3>
              <p className="lp-tier-price">
                <strong>{t.price}</strong> <span>{t.period}</span>
              </p>
              <p className="lp-tier-summary">{t.summary}</p>
              <ul className="lp-tier-list">
                {t.includes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <SalesCta
                contact={contact}
                variant={t.featured ? "primary" : "ghost"}
                className="lp-tier-cta"
              >
                Consultar por {t.name}
              </SalesCta>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 06 preguntas ---------- */

export function LandingFaq() {
  return (
    <section id="preguntas" className="lp-section lp-section--alt">
      <div className="lp-wrap lp-faq-grid">
        <div>
          <span className="lp-eyebrow">Preguntas</span>
          <h2>Lo que preguntan antes de decir que sí</h2>
        </div>
        <div className="lp-faq-list">
          {FAQS.map((f) => (
            <details key={f.q} className="lp-faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 07 cierre + footer ---------- */

export function LandingClosing({ contact }: { contact: SalesContact }) {
  return (
    <section id="contacto" className="lp-closing">
      <div className="lp-wrap">
        <p className="lp-statement">
          ¿Arrancamos
          <br />
          con la tuya?
        </p>
        <div className="lp-contact-panel">
          <div>
            <h2 className="lp-contact-title">Escribinos por WhatsApp</h2>
            <p>
              Contanos qué hace tu negocio. Te decimos qué plan te sirve y qué
              datos necesitamos para empezar.
            </p>
          </div>
          <SalesCta contact={contact}>
            {contact.display ?? "Escribinos por WhatsApp"}
          </SalesCta>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter({ contact }: { contact: SalesContact }) {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-inner">
        <span>© {new Date().getFullYear()} sitio.com.py · Hecho en Paraguay</span>
        <span className="lp-footer-links">
          <a href="#incluye">Qué incluye</a>
          <a href="#precio">Precio</a>
          <a href="#preguntas">Preguntas</a>
          {contact.display ? <span className="lp-footer-phone">{contact.display}</span> : null}
        </span>
      </div>
    </footer>
  );
}

/** Fast CTA på mobil — samma mål som resten av sidan. */
export function LandingDock({ contact }: { contact: SalesContact }) {
  return (
    <SalesCta contact={contact} className="lp-dock">
      Pedir mi página
    </SalesCta>
  );
}
