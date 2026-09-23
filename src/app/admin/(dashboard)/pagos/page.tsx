import Link from "next/link";
import { listExpiringSoon, listPendingPayments } from "@/db/billing-queries";
import { requireRole } from "@/lib/auth";
import { absoluteUrl } from "@/lib/env";
import { formatGs, waLink } from "@/lib/format";
import {
  EXPIRING_SOON_DAYS,
  GRACE_DAYS,
  PAYMENT_METHOD_LABELS,
  PLAN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  daysUntil,
  renewalMessage,
  toDayString,
  todayAsuncion,
  type SubscriptionStatus,
} from "@/lib/billing";
import { Badge, Card, EmptyState, Notice, SectionTitle } from "@/components/admin/ui";
import { confirmPaymentAction, rejectPaymentAction, runLifecycleAction } from "./actions";
import { reportPath } from "@/lib/year-report";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cobros" };

function expiryTone(days: number): "ok" | "warn" | "danger" {
  if (days < 0) return "danger";
  if (days <= 15) return "warn";
  return "ok";
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  await requireRole("superadmin");
  const sp = await searchParams;

  const [pending, expiring] = await Promise.all([listPendingPayments(), listExpiringSoon()]);
  const today = todayAsuncion();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Cobros</h1>
          <p className="mt-1 text-sm text-admin-muted">
            {pending.length} pago{pending.length === 1 ? "" : "s"} por confirmar ·{" "}
            {expiring.length} con vencimiento en {EXPIRING_SOON_DAYS} días
          </p>
        </div>
        <form action={runLifecycleAction}>
          <button
            type="submit"
            className="rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2 text-sm hover:border-admin-muted"
            title={`Pasa las suscripciones con vencimiento cumplido al período de gracia (${GRACE_DAYS} días) y luego a vencida, y pausa el sitio. También se ejecuta cada noche con la tarea cron.`}
          >
            Ejecutar control de vencimientos ahora
          </button>
        </form>
      </div>

      {sp.ok ? <Notice tone="ok">{sp.ok}</Notice> : null}

      <Card>
        <SectionTitle hint="Un pago registrado no extiende nada hasta que lo confirmás. La confirmación extiende el período y publica el sitio si estaba en pausa por falta de pago.">
          Por confirmar
        </SectionTitle>

        {pending.length === 0 ? (
          <EmptyState title="No hay pagos pendientes." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-line">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-admin-line bg-admin-surface-2 text-left text-xs tracking-wide text-admin-muted uppercase">
                  <th className="px-3 py-2 font-medium">Sitio</th>
                  <th className="px-3 py-2 font-medium">Monto</th>
                  <th className="px-3 py-2 font-medium">Método</th>
                  <th className="px-3 py-2 font-medium">Período</th>
                  <th className="px-3 py-2 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id} className="border-b border-admin-line last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/admin/sitios/${p.businessId}`} className="font-medium hover:text-admin-accent">
                        {p.businessName}
                      </Link>
                      <span className="block font-mono text-xs text-admin-muted">/{p.slug}</span>
                    </td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{formatGs(Number(p.amountGs))}</td>
                    <td className="px-3 py-2">
                      {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}
                      {p.reference ? <span className="block text-xs text-admin-muted">{p.reference}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-admin-muted">
                      {toDayString(p.periodStart)} → {toDayString(p.periodEnd)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex gap-2">
                        <form action={confirmPaymentAction}>
                          <input type="hidden" name="paymentId" value={p.id} />
                          <input type="hidden" name="back" value="/admin/pagos" />
                          <button type="submit" className="rounded-md bg-admin-ok px-2.5 py-1.5 text-xs font-medium text-admin-bg">
                            Confirmar
                          </button>
                        </form>
                        <form action={rejectPaymentAction}>
                          <input type="hidden" name="paymentId" value={p.id} />
                          <input type="hidden" name="back" value="/admin/pagos" />
                          <button
                            type="submit"
                            className="rounded-md border border-admin-line px-2.5 py-1.5 text-xs text-admin-muted hover:text-admin-danger"
                          >
                            Rechazar
                          </button>
                        </form>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle hint="El mensaje incluye las cifras del año como argumento para la renovación. Si no hay tráfico, las cifras se omiten.">
          Vencen pronto (≤ {EXPIRING_SOON_DAYS} días)
        </SectionTitle>

        {expiring.length === 0 ? (
          <EmptyState title="No hay vencimientos en las próximas semanas." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-line">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-admin-line bg-admin-surface-2 text-left text-xs tracking-wide text-admin-muted uppercase">
                  <th className="px-3 py-2 font-medium">Sitio</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Vence</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-right font-medium">Año: visitas / WA</th>
                  <th className="px-3 py-2 text-right font-medium">Renovación</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((row) => {
                  const left = daysUntil(row.expiresAt, today);
                  const siteUrl = absoluteUrl(`/${row.slug}`);
                  const href = waLink(
                    row.whatsappPhone,
                    renewalMessage({
                      businessName: row.businessName,
                      priceGs: Number(row.priceGs),
                      views365: row.views365,
                      waClicks365: row.waClicks365,
                      siteUrl,
                      reportUrl: absoluteUrl(reportPath(row.businessId, row.slug)),
                    }),
                  );

                  return (
                    <tr key={row.subscriptionId} className="border-b border-admin-line last:border-0">
                      <td className="px-3 py-2">
                        <Link href={`/admin/sitios/${row.businessId}`} className="font-medium hover:text-admin-accent">
                          {row.businessName}
                        </Link>
                        <span className="block font-mono text-xs text-admin-muted">
                          /{row.slug}
                          {row.businessStatus === "paused" ? " · en pausa" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {PLAN_LABELS[row.plan as keyof typeof PLAN_LABELS] ?? row.plan}
                        <span className="block font-mono text-xs text-admin-muted">{formatGs(Number(row.priceGs))}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {toDayString(row.expiresAt)}
                        <span className="block text-xs text-admin-muted">
                          {left >= 0 ? `en ${left} días` : `${Math.abs(left)} días atrás`}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={expiryTone(left)}>
                          {SUBSCRIPTION_STATUS_LABELS[row.status as SubscriptionStatus] ?? row.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                        {row.views365} / {row.waClicks365}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <a href={href} target="_blank" rel="noreferrer" className="text-admin-accent hover:underline">
                          WhatsApp →
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
