import Link from "next/link";
import { countByStatus, listBusinesses } from "@/db/queries";
import { ensureRollupFresh } from "@/lib/rollup";
import { BUSINESS_STATUSES, CATEGORY_LABELS, STATUS_LABELS, type BusinessStatus } from "@/lib/business";
import { Badge, ButtonLink, EmptyState, StatusBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

function isStatus(v: string): v is BusinessStatus {
  return (BUSINESS_STATUSES as readonly string[]).includes(v);
}

function subscriptionTone(status: string | null): "ok" | "warn" | "danger" | "neutral" {
  switch (status) {
    case "active":
      return "ok";
    case "trial":
    case "grace":
      return "warn";
    case "expired":
    case "canceled":
      return "danger";
    default:
      return "neutral";
  }
}

const SUB_LABELS: Record<string, string> = {
  trial: "Prueba",
  active: "Pagada",
  grace: "Período de gracia",
  expired: "Vencida",
  canceled: "Cancelada",
};

export default async function AdminSitesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status && isStatus(sp.status) ? sp.status : "all";

  // Lazy rollup före listan: kolumnerna läser analytics_daily, och den ska
  // vara färsk även om hPanel-cron aldrig sattes upp.
  await ensureRollupFresh();
  const [rows, counts] = await Promise.all([listBusinesses({ q, status }), countByStatus()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Sitios</h1>
          <p className="mt-1 text-sm text-admin-muted">
            {total} en total · {counts.published ?? 0} publicados · {counts.pending_review ?? 0} pendientes de revisión
          </p>
        </div>
        <ButtonLink href="/admin/sitios/nuevo" variant="primary">
          Nuevo sitio
        </ButtonLink>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/admin">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscá por nombre, enlace o ciudad…"
          className="min-w-56 flex-1 rounded-lg border border-admin-line bg-admin-surface px-3 py-2 text-sm outline-none focus:border-admin-accent"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-admin-line bg-admin-surface px-3 py-2 text-sm outline-none focus:border-admin-accent"
        >
          <option value="all">Todos los estados</option>
          {BUSINESS_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]} ({counts[s] ?? 0})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2 text-sm hover:border-admin-muted"
        >
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={q || status !== "all" ? "Ningún sitio coincide con el filtro." : "Todavía no hay sitios."}>
          <Link href="/admin/sitios/nuevo" className="text-admin-accent hover:underline">
            Creá el primero
          </Link>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-admin-line">
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-admin-line bg-admin-surface text-left text-xs tracking-wide text-admin-muted uppercase">
                <th className="px-4 py-3 font-medium">Sitio</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 text-right font-medium" title="Visitas en los últimos 30 días">
                  Visitas, 30 días
                </th>
                <th className="px-4 py-3 text-right font-medium" title="Clics en WhatsApp en los últimos 30 días">
                  WA, 30 días
                </th>
                <th className="px-4 py-3 text-right font-medium">Puntaje</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-admin-line last:border-0 hover:bg-admin-surface">
                  <td className="px-4 py-3">
                    <Link href={`/admin/sitios/${row.id}`} className="font-medium text-admin-text hover:text-admin-accent">
                      {row.name}
                    </Link>
                    <div className="mt-0.5 font-mono text-xs text-admin-muted">
                      /{row.slug} · {CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] ?? row.category} ·{" "}
                      {row.zone ? `${row.zone}, ` : ""}
                      {row.city}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={subscriptionTone(row.subscriptionStatus)}>
                        {row.subscriptionStatus ? (SUB_LABELS[row.subscriptionStatus] ?? row.subscriptionStatus) : "Ninguna"}
                      </Badge>
                      {row.pendingPayments > 0 ? (
                        <Badge tone="warn" title="Pagos pendientes de confirmación">
                          {row.pendingPayments} por confirmar
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {row.whatsappVerifiedAt ? (
                      <Badge tone="ok">Verificado</Badge>
                    ) : (
                      <Badge tone="warn">Sin verificar</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{Number(row.views30d)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{Number(row.waClicks30d)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono">{row.upsellScore}</span>
                    {row.hotLead ? <span className="ml-1.5 text-admin-danger">●</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
