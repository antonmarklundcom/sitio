import { displayPhone } from "@/lib/format";
import { absoluteUrl } from "@/lib/env";
import { siteOptions } from "@/lib/growth";
import { LeadForm } from "./lead-form";
import { groupedHours, type OpenState } from "@/lib/hours";
import { SiteImage, WhatsAppGlyph } from "./primitives";
import { StatusPill } from "./hero";
import type { ThemeMedia } from "@/themes/types";
import type { Business } from "@/db/schema";

/**
 * De delade sektionsblocken. Alla fyra teman bygger sin sida av exakt de här
 * blocken plus modulprimitiven (SiteMenu, SiteProducts) — temat väljer bara
 * ORDNING och sin egen text. Det är det som gör att de fyra läser som en
 * produktlinje i stället för fyra sajter.
 *
 * Blocken renderar null när deras data saknas, så bas-planen (inga foton,
 * inga moduler, inga tjänster) faller ihop till hero → var/när → avslut —
 * tre block som fortfarande ser avsiktliga ut.
 */

/* ---------- 02 tjänster ---------- */

export function SiteServices({
  services,
  eyebrow,
  title,
  wa,
  askTitle,
  askBody,
  askCta,
  evLoc,
}: {
  services: { name: string; desc?: string }[];
  eyebrow: string;
  title: string;
  wa: string;
  askTitle: string;
  askBody: string;
  askCta: string;
  evLoc: string;
}) {
  if (services.length === 0) return null;

  return (
    <section id="servicios" className="block">
      <div className="wrap">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <ul className="svc-list">
          {services.map((service, i) => (
            <li key={`${service.name}-${i}`} className="svc-item reveal">
              <span className="svc-n" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{service.name}</h3>
                {service.desc ? <p>{service.desc}</p> : null}
              </div>
            </li>
          ))}
        </ul>

        {/* Slutraden är inte dekor: den fångar besökaren som inte hittade
            sitt ärende i listan, som annars lämnar sidan utan att skriva. */}
        <div className="svc-ask reveal">
          <div>
            <h3>{askTitle}</h3>
            <p>{askBody}</p>
          </div>
          <a
            href={wa}
            target="_blank"
            rel="noreferrer noopener"
            data-ev="whatsapp_click"
            data-ev-loc={evLoc}
            className="btn btn--primary"
          >
            {askCta}
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------- 03 foton ---------- */

export function SitePhotos({
  business,
  photos,
  eyebrow,
  title,
}: {
  business: Business;
  photos: ThemeMedia[];
  eyebrow: string;
  title: string;
}) {
  if (photos.length === 0) return null;

  return (
    <section id="fotos" className="block" data-ev-view="gallery_view">
      <div className="wrap">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {/* .reveal ligger på railen, aldrig på dess barn: ett kort som är
          bortskrollat i sidled skär inte viewporten och skulle aldrig få
          .is-in — vilket QA-gaten (korrekt) rapporterar som ett fel. */}
      <ul className="rail reveal">
        {photos.map((photo) => (
          <li key={photo.id} className="tile">
            <SiteImage
              businessId={business.id}
              variants={photo.variantsJson ?? {}}
              alt={photo.altText ?? `${business.name}, ${business.city}`}
              sizes="(min-width: 768px) 40vw, 76vw"
              width={photo.width}
              height={photo.height}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- 04 var och när ---------- */

export function SiteWhereWhen({
  business,
  status,
  eyebrow,
  title,
  noHoursNote,
}: {
  business: Business;
  status: OpenState | null;
  eyebrow: string;
  title: string;
  /** Vad som står när kunden varken har fyllt i adress eller öppettider. */
  noHoursNote: string;
}) {
  const hours = groupedHours(business.hoursJson);
  const place = [business.zone, business.city].filter(Boolean).join(", ");

  return (
    <section id="donde" className="block">
      <div className="wrap info-grid">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {business.address ? (
            <p className="addr">
              {business.address}
              {place ? (
                <>
                  <br />
                  {place}
                </>
              ) : null}
            </p>
          ) : (
            <p className="addr">{place || noHoursNote}</p>
          )}
          {business.mapsUrl ? (
            <a
              href={business.mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              data-ev="map_click"
              data-ev-loc="donde"
              className="btn btn--quiet"
            >
              Cómo llegar
            </a>
          ) : null}
        </div>

        <div>
          <StatusPill status={status} hours={business.hoursJson} />
          {hours.length > 0 ? (
            <dl className="hours-list reveal">
              {hours.map((row) => (
                <div key={row.days} className="hours-row">
                  <dt>{row.days}</dt>
                  <dd>{row.intervals ? row.intervals.map((i) => `${i.open}–${i.close}`).join(" · ") : "Cerrado"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="addr-sub">{noHoursNote}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- 05 avslut + footer (ett mörkt band) ---------- */

export function SiteClosing({
  business,
  wa,
  statement,
  ctaTitle,
  ctaBody,
  ctaLabel,
  booking = false,
}: {
  business: Business;
  wa: string;
  /** booking-modulen på ⇒ formuläret blir en turno-förfrågan (growth-1). */
  booking?: boolean;
  /** Temats egen slutrad. Kort — den sätts i display-snittet, stort. */
  statement: string;
  ctaTitle: string;
  ctaBody: string;
  ctaLabel: string;
}) {
  const socials = business.socialsJson ?? {};
  const hasSocials = Boolean(socials.instagram || socials.facebook || socials.tiktok);
  const options = siteOptions(business.siteOptionsJson);
  const showForm = booking || options.leadForm;
  const reviewUrl = options.reviewButton ? business.googleReviewUrl : null;
  const services = (Array.isArray(business.servicesJson) ? business.servicesJson : [])
    .map((s) => s?.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0)
    .slice(0, 12);

  return (
    <section id="contacto" className="closing grain">
      <div className="wrap">
        <p className="statement">{statement}</p>

        <div className="plate closing-plate reveal">
          <div>
            <h2>{ctaTitle}</h2>
            <p>{ctaBody}</p>
          </div>
          <a
            href={wa}
            target="_blank"
            rel="noreferrer noopener"
            data-ev="whatsapp_click"
            data-ev-loc="contacto"
            className="btn btn--wa btn--block"
          >
            <WhatsAppGlyph />
            {ctaLabel}
          </a>
          {/* Andratelefonen när den finns — annars WhatsApp-numret. En kund som
              hellre ringer ska inte behöva leta efter numret i sidfoten. */}
          <p className="closing-note">
            O llamanos al{" "}
            <a
              href={`tel:${business.secondaryPhone ?? business.whatsappPhone}`}
              data-ev="phone_click"
              data-ev-loc="contacto"
            >
              {displayPhone(business.secondaryPhone ?? business.whatsappPhone)}
            </a>
          </p>
          {showForm ? <LeadForm businessId={business.id} booking={booking} services={services} /> : null}
          {reviewUrl ? (
            <a href={reviewUrl} target="_blank" rel="noreferrer noopener" className="btn btn--quiet btn--block" data-ev="social_click" data-ev-loc="resena">
              ★ Dejanos una reseña en Google
            </a>
          ) : null}
        </div>
      </div>

      <div className="wrap">
        <footer className="site-footer">
          <div className="footer-inner">
            <span>
              © {new Date().getFullYear()} {business.name}
              {business.ruc ? ` · RUC ${business.ruc}` : ""}
            </span>
            {hasSocials ? (
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
            {options.credit ? (
              <a href={absoluteUrl(business.referralCode ? `/registro?ref=${business.referralCode}` : "/")} className="footer-credit">
                Hecho con sitio.com.py
              </a>
            ) : null}
          </div>
        </footer>
      </div>
    </section>
  );
}

/* ---------- fast CTA ---------- */

/** Hela produktens konverteringspunkt. Syns på varje scrolldjup, aldrig som popup. */
export function WaDock({ wa, label }: { wa: string; label: string }) {
  return (
    <a
      href={wa}
      target="_blank"
      rel="noreferrer noopener"
      data-ev="whatsapp_click"
      data-ev-loc="dock"
      className="btn btn--wa wa-dock"
    >
      <WhatsAppGlyph />
      {label}
    </a>
  );
}
