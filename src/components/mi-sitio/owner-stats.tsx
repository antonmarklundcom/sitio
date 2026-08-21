import type { BusinessAnalytics } from "@/db/analytics-queries";

/**
 * Statistiken som kunden ser. Samma data som adminets panel, men på spanska
 * och utan de siffror en företagare inte har nytta av.
 *
 * Det här är också säljargumentet vid förnyelsen (PLAN.md §1.7) — därför visas
 * året, inte bara månaden.
 */
export function OwnerStats({ analytics }: { analytics: BusinessAnalytics }) {
  const { series30, last30, last365 } = analytics;
  const peak = Math.max(1, ...series30.map((p) => p.views));
  const hasData = series30.some((p) => p.views > 0 || p.waClicks > 0);
  const nf = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });

  return (
    <div className="panel-card">
      <h2>Tu página en números</h2>

      {hasData ? (
        <>
          <div className="panel-chart" role="img" aria-label="Visitas por día, últimos 30 días">
            {series30.map((point) => (
              <div key={point.day} title={`${point.day}: ${point.views} visitas, ${point.waClicks} WhatsApp`}>
                {point.waClicks > 0 ? (
                  <div className="wa" style={{ height: `${Math.max(4, (point.waClicks / peak) * 100)}%` }} />
                ) : null}
                <div className="views" style={{ height: `${(point.views / peak) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="panel-chart-legend">
            <span>
              <i className="views" style={{ background: "color-mix(in srgb, var(--accent) 45%, transparent)" }} />
              Visitas
            </span>
            <span>
              <i className="wa" style={{ background: "var(--accent)" }} />
              Contactos por WhatsApp
            </span>
          </div>
        </>
      ) : (
        <p>Todavía no hay visitas registradas. En cuanto empiecen a entrar, las vas a ver acá.</p>
      )}

      <div className="panel-stats" style={{ marginTop: "1rem" }}>
        <div className="panel-stat">
          <b>{nf.format(last30.views)}</b>
          <span>Visitas (30 días)</span>
        </div>
        <div className="panel-stat">
          <b>{nf.format(last30.waClicks)}</b>
          <span>WhatsApp (30 días)</span>
        </div>
        <div className="panel-stat">
          <b>{nf.format(last365.views)}</b>
          <span>Visitas (1 año)</span>
        </div>
        <div className="panel-stat">
          <b>{nf.format(last365.waClicks)}</b>
          <span>WhatsApp (1 año)</span>
        </div>
      </div>
    </div>
  );
}
