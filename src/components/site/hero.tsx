import { displayPhone } from "@/lib/format";
import type { OpenState } from "@/lib/hours";
import { SiteImage, WhatsAppGlyph } from "./primitives";
import type { ThemeMedia } from "@/themes/types";
import type { Business } from "@/db/schema";

/**
 * Hero — "la placa". ETT mönster för alla fyra teman (plan: temafamiljen
 * ska läsa som en produktlinje), och det enda stället där themes får
 * skilja sig är färg, radie, textur och fotobehandling — allt via CSS.
 *
 * Mönstret: en helbredd bild i fast beskärning, och ovanpå dess underkant
 * en upphöjd platta med namn, en rad om vad de gör, "abierto ahora", och
 * WhatsApp-knappen. Plattan sitter i tumzonen på en telefon, och besökaren
 * har allt hen behöver för att skriva utan att skrolla.
 *
 * Utan foto byts bilden mot ett MONOGRAM: initialerna satta stort mot temats
 * mörka ton. Nästan varje ny kund saknar bra foton första veckan, och en tom
 * heroyta är skillnaden mellan "ny sajt" och "trasig sajt".
 *
 * Ingen entré-animation ovanför vecket — den fördröjer LCP, och LCP är det
 * enda prestandatal som märks på en paraguayansk telefon.
 */

/** Initialer för monogrammet: "Cocina de Ña Rosa" → "CR", "Piriz" → "PI". */
export function initials(name: string): string {
  const skip = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "da", "do", "dos"]);
  const words = name
    .split(/[\s·/|,-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length > 0 && !skip.has(w.toLowerCase()));

  if (words.length === 0) return name.slice(0, 2).toUpperCase() || "·";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** "Abierto ahora · cierra 18:00" — samma mening överallt den visas. */
export function statusText(status: OpenState | null): string | null {
  if (!status) return null;
  if (status.open) return `Abierto ahora · cierra ${status.closesAt}`;
  if (status.opensAt) return `Cerrado · abre ${status.opensDay ? `${status.opensDay} ` : ""}${status.opensAt}`;
  return "Consultanos el horario por WhatsApp";
}

export function StatusPill({ status }: { status: OpenState | null }) {
  const text = statusText(status);
  if (!text) return null;
  return (
    <p className="status">
      <span className={status?.open ? "dot dot--open" : "dot"} aria-hidden="true" />
      {text}
    </p>
  );
}

export function SiteHero({
  business,
  hero,
  logo,
  status,
  wa,
  ctaLabel,
  eyebrow,
  chips,
}: {
  business: Business;
  hero: ThemeMedia | null;
  logo: ThemeMedia | null;
  status: OpenState | null;
  wa: string;
  /** Temats egen uppmaning — "Pedir presupuesto", "Hacer un pedido", … */
  ctaLabel: string;
  eyebrow: string;
  /** 0–4 korta fakta. Tomma strängar filtreras bort av anroparen. */
  chips: string[];
}) {
  // h1 härleds deterministiskt. seoTitle är redigerbar i admin och vinner när
  // den finns — men den får aldrig sönderdelas med strängtrick.
  const place = business.zone ? `${business.zone}, ${business.city}` : business.city;
  const headline = business.seoTitle ?? `${business.name} en ${place}`;
  const hasPhoto = Boolean(hero?.variantsJson);

  return (
    <header className={`hero${hasPhoto ? "" : " hero--mono"}`}>
      <div className="hero-media">
        {hasPhoto && hero?.variantsJson ? (
          <SiteImage
            businessId={business.id}
            variants={hero.variantsJson}
            alt={hero.altText ?? `${business.name} en ${business.city}`}
            sizes="100vw"
            priority
            width={hero.width}
            height={hero.height}
          />
        ) : (
          <div className="hero-mono" aria-hidden="true">
            <span>{initials(business.name)}</span>
            <span className="hero-texture" />
          </div>
        )}
        <div className="hero-veil" aria-hidden="true" />

        <div className="wrap hero-bar">
          {logo?.variantsJson ? (
            <SiteImage
              businessId={business.id}
              variants={logo.variantsJson}
              alt={`${business.name} logo`}
              sizes="120px"
              priority
              className="site-logo"
            />
          ) : (
            <span className="hero-mark">{business.name}</span>
          )}
          <a href={`tel:${business.whatsappPhone}`} data-ev="phone_click" data-ev-loc="header" className="hero-call">
            Llamar
          </a>
        </div>
      </div>

      <div className="wrap">
        <div className="plate hero-plate">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{headline}</h1>
          {business.description ? <p className="lede">{business.description}</p> : null}
          <StatusPill status={status} />

          {/* En enda uppmaning i plattan. Andratelefonen ligger i avslutsblocket:
              två knappar sida vid sida på 360 px radbryter numret och delar
              uppmärksamheten som CTA:n behöver ha hel. */}
          <div className="hero-actions">
            <a
              href={wa}
              target="_blank"
              rel="noreferrer noopener"
              data-ev="whatsapp_click"
              data-ev-loc="hero"
              className="btn btn--wa btn--block"
            >
              <WhatsAppGlyph />
              {ctaLabel}
            </a>
          </div>
          <p className="hero-sub">Te respondemos al {displayPhone(business.whatsappPhone)}</p>

          {chips.length > 0 ? (
            <ul className="chips">
              {chips.map((chip) => (
                <li key={chip} className="chip">
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </header>
  );
}
