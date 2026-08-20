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
  type SubscriptionStatus,
} from "@/lib/billing";
import { Badge, Card, EmptyState, Notice, SectionTitle } from "@/components/admin/ui";
import { confirmPaymentAction, rejectPaymentAction, runLifecycleAction } from "./actions";

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
  const today = toDayString(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Cobros</h1>
          <p className="mt-1 text-sm text-admin-muted">
            {pending.length} betalning{pending.length === 1 ? "" : "ar"} att bekräfta ·{" "}
            {expiring.length} förfaller inom {EXPIRING_SOON_DAYS} dagar
          </p>
        </div>
        <form action={runLifecycleAction}>
          <button
            type="submit"
            className="rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2 text-sm hover:border-admin-muted"
            title={`Sätter förfallna prenumerationer till respit (${GRACE_DAYS} dgr) och därefter förfallen, och pausar sajten. Körs annars av cron-jobbet varje natt.`}
          >
            Kör förfallokontroll nu
          </button>
        </form>
      </div>

      {sp.ok ? <Notice tone="ok">{sp.ok}</Notice> : null}

      <Card>
        <SectionTitle hint="En registrerad betalning förlänger ingenting förrän du bekräftar den. Bekräftelsen förlänger perioden och publicerar en sajt som pausats för utebliven betalning.">
          Att bekräfta
        </SectionTitle>

        {pending.length === 0 ? (
          <EmptyState title="Inga betalningar väntar." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-line">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-admin-line bg-admin-surface-2 text-left text-xs tracking-wide text-admin-muted uppercase">
                  <th className="px-3 py-2 font-medium">Sajt</th>
                  <th className="px-3 py-2 font-medium">Belopp</th>
                  <th className="px-3 py-2 font-medium">Metod</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 text-right font-medium">Åtgärd</th>
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
                            Bekräfta
                          </button>
                        </form>
                        <form action={rejectPaymentAction}>
                          <input type="hidden" name="paymentId" value={p.id} />
                          <input type="hidden" name="back" value="/admin/pagos" />
                          <button
                            type="submit"
                            className="rounded-md border border-admin-line px-2.5 py-1.5 text-xs text-admin-muted hover:text-admin-danger"
                          >
                            Avvisa
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
        <SectionTitle hint="Meddelandet innehåller årets siffror — det är säljargumentet vid förnyelsen. Saknas trafik utelämnas siffrorna hellre än att skönmålas.">
          Vencen pronto (≤ {EXPIRING_SOON_DAYS} dagar)
        </SectionTitle>

        {expiring.length === 0 ? (
          <EmptyState title="Inget förfaller de närmaste veckorna." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-line">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-admin-line bg-admin-surface-2 text-left text-xs tracking-wide text-admin-muted uppercase">
                  <th className="px-3 py-2 font-medium">Sajt</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Förfaller</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">År: besök / WA</th>
                  <th className="px-3 py-2 text-right font-medium">Förnyelse</th>
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
                          {row.businessStatus === "paused" ? " · pausad" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {PLAN_LABELS[row.plan as keyof typeof PLAN_LABELS] ?? row.plan}
                        <span className="block font-mono text-xs text-admin-muted">{formatGs(Number(row.priceGs))}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {toDayString(row.expiresAt)}
                        <span className="block text-xs text-admin-muted">
                          {left >= 0 ? `om ${left} dgr` : `${Math.abs(left)} dgr sedan`}
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
