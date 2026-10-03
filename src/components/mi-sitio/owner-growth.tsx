import Link from "next/link";
import { displayPhone } from "@/lib/format";
import { PLAN_UPGRADE_KEY, type UpsellService } from "@/lib/growth";
import { statusLabel } from "@/lib/crm";
import type { SiteLead } from "@/db/schema";

/**
 * Tillväxtkorten i /mi-sitio (growth-1). Serverkomponenter med vanliga
 * formulär mot serveråtgärder — ingen klient-JS behövs för en knapp.
 * Spanska (voseo) — kundens yta.
 */

function dateTimeEs(value: Date): string {
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

/**
 * Kortet på /mi-sitio: räknare, de tre senaste och en länk till hela CRM:et
 * (/mi-sitio/clientes, crm-1). Ankaret #consultas finns kvar för länkar och push.
 */
export function OwnerInbox({
  fresh,
  due,
  total,
  latest,
  siteQuery = "",
}: {
  fresh: number;
  due: number;
  total: number;
  latest: SiteLead[];
  siteQuery?: string;
}) {
  return (
    <div className="panel-card" id="consultas">
      <h2>
        Mis clientes {fresh > 0 ? <span className="panel-badge">{fresh === 1 ? "1 nueva" : `${fresh} nuevas`}</span> : null}
      </h2>
      {total === 0 ? (
        <p className="hint">
          Cuando alguien deje su número en tu página, aparece acá con un botón para responderle por WhatsApp.
        </p>
      ) : (
        <>
          <p>
            {fresh === 1 ? "1 consulta nueva" : `${fresh} consultas nuevas`} · {due === 1 ? "1 para hoy" : `${due} para hoy`}
          </p>
          <ul className="panel-leads">
            {latest.map((lead) => (
              <li key={lead.id} className={`panel-lead panel-lead--${lead.status}`}>
                <div className="panel-lead-head">
                  <strong>{lead.name}</strong>
                  <span className="hint">
                    {dateTimeEs(new Date(lead.createdAt))} · {statusLabel(lead.status)} · {displayPhone(lead.phone)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p>
        <Link href={`/mi-sitio/clientes${siteQuery}`} className="panel-btn panel-btn--small">
          Ver todos mis clientes
        </Link>
      </p>
    </div>
  );
}

export function OwnerReferral({
  link,
  shareHref,
  rewardDays,
  stats,
}: {
  link: string;
  shareHref: string;
  rewardDays: number;
  stats: { signedUp: number; paid: number };
}) {
  return (
    <div className="panel-card" id="recomenda">
      <h2>Recomendá y ganá</h2>
      <p>
        Pasale tu enlace a otro negocio. Cuando pague su primer año
        {rewardDays > 0 ? `, vos sumás ${rewardDays} días gratis a tu plan y el otro negocio también` : ", te avisamos"}.
      </p>
      <p className="panel-copy">
        <code>{link}</code>
      </p>
      <div className="panel-actions">
        <a href={shareHref} target="_blank" rel="noreferrer" className="panel-btn">
          Compartir por WhatsApp
        </a>
      </div>
      {stats.signedUp > 0 ? (
        <p className="hint">
          Se registraron {stats.signedUp} con tu enlace · {stats.paid} ya pagaron.
        </p>
      ) : null}
    </div>
  );
}

export function OwnerServices({
  services,
  recommendedKey,
  openKeys,
  showPlanUpgrade,
  requested,
  readOnly,
  request,
}: {
  services: UpsellService[];
  recommendedKey: string;
  openKeys: Set<string>;
  showPlanUpgrade: boolean;
  requested: boolean;
  readOnly: boolean;
  request: (formData: FormData) => Promise<void>;
}) {
  const cards = [
    ...(showPlanUpgrade
      ? [
          {
            key: PLAN_UPGRADE_KEY,
            title: "Pasate al plan Plus",
            body: "Galería de hasta 20 fotos y tu menú o catálogo de productos en la página.",
            price: "",
            enabled: true,
          },
        ]
      : []),
    ...services.filter((s) => s.enabled),
  ];
  // Rekommendationen först — det är den siffrorna pekar på.
  cards.sort((a, b) => Number(b.key === recommendedKey) - Number(a.key === recommendedKey));
  if (cards.length === 0) return null;

  return (
    <div className="panel-card" id="crecer">
      <h2>Hacé crecer tu negocio</h2>
      <p>Además de tu página, te ayudamos a conseguir más clientes. Tocá “Me interesa” y lo hablamos por WhatsApp.</p>
      {requested ? <p className="panel-note panel-note--ok">¡Recibimos tu pedido! Te escribimos pronto.</p> : null}
      <div className="panel-services">
        {cards.map((s) => (
          <div key={s.key} className={`panel-service${s.key === recommendedKey ? " panel-service--rec" : ""}`}>
            {s.key === recommendedKey ? <span className="panel-badge">Recomendado para vos</span> : null}
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            {s.price ? <p className="panel-service-price">{s.price}</p> : null}
            {readOnly ? null : openKeys.has(s.key) ? (
              <p className="hint">Ya lo pediste — te escribimos pronto.</p>
            ) : (
              <form action={request}>
                <input type="hidden" name="serviceKey" value={s.key} />
                <button type="submit" className="panel-btn panel-btn--ghost panel-btn--small">
                  Me interesa
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
