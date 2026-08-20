import type { BusinessAnalytics } from "@/db/analytics-queries";
import { Card, SectionTitle } from "./ui";

/**
 * Statistikpanel per sajt: 30-dagarsgraf + summor för 30 och 365 dagar.
 *
 * Grafen är byggd av divs, inte av ett diagrambibliotek — 30 staplar är inte
 * värda 40 kB JS i en admin som ska ladda på paraguayansk mobil. Siffrorna är
 * också själva säljargumentet vid förnyelsen (PLAN.md §1.7), så de ska gå att
 * läsa exakt, inte bara som en form: varje stapel har title-text.
 *
 * Svenska: superadmin-UI.
 */
function Metric({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">{value.toLocaleString("sv-SE")}</div>
      <div className="text-xs text-admin-muted">{label}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-admin-muted/70">{hint}</div> : null}
    </div>
  );
}

export function AnalyticsPanel({ analytics }: { analytics: BusinessAnalytics }) {
  const { series30, last30, last365 } = analytics;
  const peak = Math.max(1, ...series30.map((p) => p.views));
  const hasData = series30.some((p) => p.views > 0 || p.waClicks > 0);

  return (
    <Card>
      <SectionTitle hint="Bots är bortfiltrerade. Förhandsvisningar räknas aldrig.">
        Statistik
      </SectionTitle>

      {hasData ? (
        <div className="mb-5">
          <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Besök per dag, senaste 30 dagarna">
            {series30.map((point) => (
              <div
                key={point.day}
                title={`${point.day}: ${point.views} besök, ${point.uniques} unika, ${point.waClicks} WhatsApp`}
                className="flex flex-1 flex-col justify-end gap-[2px]"
              >
                {point.waClicks > 0 ? (
                  <div
                    className="w-full rounded-sm bg-admin-ok"
                    style={{ height: `${Math.max(3, (point.waClicks / peak) * 100)}%` }}
                  />
                ) : null}
                <div
                  className="w-full rounded-sm bg-admin-accent/70"
                  style={{ height: `${(point.views / peak) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-admin-muted">
            <span>{series30[0]?.day}</span>
            <span>
              <span className="mr-3">
                <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-admin-accent/70 align-middle" />
                Besök
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-admin-ok align-middle" />
                WhatsApp
              </span>
            </span>
            <span>{series30[series30.length - 1]?.day}</span>
          </div>
        </div>
      ) : (
        <p className="mb-5 rounded-lg border border-dashed border-admin-line px-3 py-6 text-center text-sm text-admin-muted">
          Ingen trafik registrerad ännu. Beaconen körs bara på publicerade sajter.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Besök, 30 dgr" value={last30.views} />
        <Metric label="Unika/dag, 30 dgr" value={last30.uniques} hint="summa per dygn" />
        <Metric label="WhatsApp, 30 dgr" value={last30.waClicks} />
        <Metric label="Telefon, 30 dgr" value={last30.phoneClicks} />
        <Metric label="Besök, 365 dgr" value={last365.views} />
        <Metric label="WhatsApp, 365 dgr" value={last365.waClicks} />
        <Metric label="Karta, 365 dgr" value={last365.mapClicks} />
        <Metric label="Sociala, 365 dgr" value={last365.socialClicks} />
      </div>
    </Card>
  );
}
