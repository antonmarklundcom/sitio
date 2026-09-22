import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { getCurrentSubscription } from "@/db/billing-queries";
import { getYearReport } from "@/db/year-report-queries";
import { absoluteUrl, env } from "@/lib/env";
import { formatGs, normalizePyPhone, waLink } from "@/lib/format";
import { PLAN_LABELS, daysUntil, toDayString } from "@/lib/billing";
import { ctaLabel } from "@/lib/cta-labels";
import { bestMonth, monthLabelEs, monthShortEs, verifyReportToken } from "@/lib/year-report";

/**
 * "Tu año en cifras" (R3-23). Kundens egen sida med årets siffror — länken
 * skickas med förnyelsemeddelandet och finns i owner-panelen. Token i
 * query-strängen (HMAC, lib/year-report.ts); fel eller saknad token ger 404,
 * inte 403, så att sidan inte bekräftar vilka slugs som finns.
 *
 * Spanska (voseo) — kundens yta. Alltid färsk: siffrorna ändras varje dygn.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Tu año en cifras · sitio.com.py" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> };

const veces = (n: number) => (n === 1 ? "vez" : "veces");

function dayEs(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

export default async function YearReportPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t } = await searchParams;

  const [business] = await db
    .select({ id: businesses.id, name: businesses.name, slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.slug, slug.toLowerCase()))
    .limit(1);
  if (!business || !verifyReportToken(business.id, t)) notFound();

  const [report, subscription] = await Promise.all([
    getYearReport(business.id),
    getCurrentSubscription(business.id),
  ]);

  const nf = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });
  const peak = Math.max(1, ...report.months.map((m) => m.views));
  const best = bestMonth(report.months);
  const hasData = report.views > 0 || report.waClicks > 0;
  const sectionReads = report.sectionViews.menu + report.sectionViews.products;

  const sales = normalizePyPhone(env.salesWhatsapp);
  const renewHref =
    sales && subscription
      ? waLink(
          sales,
          `Hola! Soy de ${business.name}. Vi mi año en cifras y quiero renovar mi página (${absoluteUrl(`/${business.slug}`)}).`,
        )
      : null;
  const left = subscription ? daysUntil(subscription.expiresAt) : null;

  return (
    <div className="panel-wrap">
      <p className="hint">sitio.com.py · {business.name}</p>
      <h1>Tu año en cifras</h1>
      <p>
        Del {dayEs(report.from)} al {dayEs(report.to)}. Lo que tu página hizo por tu negocio en los últimos doce
        meses.
      </p>

      <div className="panel-card">
        <div className="panel-stats">
          <div className="panel-stat">
            <b>{nf.format(report.views)}</b>
            <span>Visitas</span>
          </div>
          <div className="panel-stat">
            <b>{nf.format(report.waClicks)}</b>
            <span>Contactos por WhatsApp</span>
          </div>
          <div className="panel-stat">
            <b>{nf.format(report.phoneClicks)}</b>
            <span>Llamadas</span>
          </div>
          <div className="panel-stat">
            <b>{nf.format(report.mapClicks)}</b>
            <span>Pidieron cómo llegar</span>
          </div>
        </div>

        {hasData ? (
          <>
            <div className="panel-chart panel-chart--months" role="img" aria-label="Visitas por mes">
              {report.months.map((m) => (
                <div key={m.month} title={`${monthLabelEs(m.month)}: ${m.views} visitas, ${m.waClicks} WhatsApp`}>
                  {m.waClicks > 0 ? (
                    <div className="wa" style={{ height: `${Math.max(4, (m.waClicks / peak) * 100)}%` }} />
                  ) : null}
                  <div className="views" style={{ height: `${(m.views / peak) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="panel-chart-axis" aria-hidden="true">
              {report.months.map((m) => (
                <span key={m.month}>{monthShortEs(m.month)}</span>
              ))}
            </div>
          </>
        ) : (
          <p>Todavía no hay visitas registradas este año. Apenas empiecen a entrar, las vas a ver acá.</p>
        )}
      </div>

      {hasData ? (
        <div className="panel-card">
          <h2>Lo más destacado</h2>
          <ul className="panel-report-list">
            {best ? (
              <li>
                Tu mejor mes fue <b>{monthLabelEs(best.month)}</b>: {nf.format(best.views)} visitas y{" "}
                {nf.format(best.waClicks)} contactos por WhatsApp.
              </li>
            ) : null}
            {report.topCta ? (
              <li>
                El botón de WhatsApp que más usaron fue el de <b>{ctaLabel(report.topCta.loc)}</b> (
                {nf.format(report.topCta.clicks)} {veces(report.topCta.clicks)}).
              </li>
            ) : null}
            {sectionReads > 0 ? (
              <li>
                Tu {report.sectionViews.menu > 0 ? "carta" : "catálogo"} se leyó{" "}
                <b>{nf.format(sectionReads)}</b> {veces(sectionReads)}.
              </li>
            ) : null}
            {report.socialClicks > 0 ? (
              <li>
                {report.socialClicks === 1
                  ? "Una persona pasó de tu página a tus redes sociales."
                  : `${nf.format(report.socialClicks)} personas pasaron de tu página a tus redes sociales.`}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {subscription ? (
        <div className="panel-card">
          <h2>Tu plan</h2>
          <p>
            Plan {PLAN_LABELS[subscription.plan]} · {formatGs(subscription.priceGs)} por año ·{" "}
            {left !== null && left < 0 ? "venció" : "vence"} el {dayEs(toDayString(subscription.expiresAt))}.
          </p>
          {renewHref ? (
            <div className="panel-actions">
              <a className="panel-btn" href={renewHref}>
                Renovar por WhatsApp
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="hint">Los bots no se cuentan. Las vistas previas nunca se cuentan.</p>
    </div>
  );
}
