import { asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { getGrowthSettings, listCommissions, listPartners } from "@/db/growth-queries";
import { requireRole } from "@/lib/auth";
import { absoluteUrl } from "@/lib/env";
import { displayPhone, formatGs, waLink } from "@/lib/format";
import { Badge, Card, EmptyState, Notice, SectionTitle } from "@/components/admin/ui";
import { assignBusinessAction, createPartnerAction, markCommissionPaidAction, updatePartnerAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Socios" };

const input = "block w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2";
const btn = "rounded-md bg-admin-text px-3 py-2 text-sm text-admin-surface";

/**
 * Säljare på provision (growth-1, idé 7). En säljare får en kod och en
 * rapportlänk; kunder som registrerar sig via /registro?ref=<kod> kopplas till
 * säljaren, och varje bekräftad betalning under första året ger en provision.
 */
export default async function SociosPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireRole("superadmin");
  const sp = await searchParams;
  const [list, commissions, settings, unassigned] = await Promise.all([
    listPartners(),
    listCommissions(),
    getGrowthSettings(),
    db
      .select({ id: businesses.id, name: businesses.name, slug: businesses.slug })
      .from(businesses)
      .where(isNull(businesses.partnerId))
      .orderBy(asc(businesses.name))
      .limit(500),
  ]);
  const pendingTotal = commissions.filter((c) => c.status === "pending").reduce((sum, c) => sum + Number(c.amountGs), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Socios (vendedores)</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Vendedores a comisión. Cada uno tiene un enlace de registro propio y una página con sus ventas. La comisión se
          calcula sobre cada pago confirmado del primer año del cliente. Por pagar: {formatGs(pendingTotal)}.
        </p>
      </div>
      {sp.ok ? <Notice tone="ok">{sp.ok}</Notice> : null}
      {sp.error ? <Notice tone="danger">{sp.error}</Notice> : null}

      <Card>
        <SectionTitle>Nuevo socio</SectionTitle>
        <form action={createPartnerAction} className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm sm:col-span-2">Nombre<input name="name" required maxLength={120} className={input} /></label>
          <label className="text-sm">WhatsApp<input name="phone" placeholder="0981 123 456" className={input} /></label>
          <label className="text-sm">Comisión %<input name="commissionPct" type="number" min={0} max={100} defaultValue={settings.partnerCommissionPct} className={input} /></label>
          <label className="text-sm sm:col-span-3">Nota<input name="notes" maxLength={300} className={input} /></label>
          <div className="self-end"><button type="submit" className={btn}>Crear socio</button></div>
        </form>
      </Card>

      <Card>
        <SectionTitle>Socios</SectionTitle>
        {list.length === 0 ? (
          <EmptyState title="Todavía no hay socios." />
        ) : (
          <ul className="space-y-3">
            {list.map((p) => {
              const signup = absoluteUrl(`/registro?ref=${p.code}`);
              const report = absoluteUrl(`/socio/${p.token}`);
              const welcome = `Hola ${p.name}! Tu enlace para registrar clientes en sitio.com.py: ${signup} . Tus ventas y comisiones las ves acá: ${report}`;
              return (
                <li key={p.id} className="rounded-lg border border-admin-line p-3 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <strong>{p.name}</strong>
                    <span className="font-mono text-xs">{p.code}</span>
                    <Badge tone={p.status === "active" ? "ok" : "neutral"}>{p.status === "active" ? "Activo" : "Inactivo"}</Badge>
                    {p.phone ? <span className="text-admin-muted">{displayPhone(p.phone)}</span> : null}
                    <span className="text-admin-muted">
                      {p.businesses} clientes · por pagar {formatGs(p.pendingGs)} · pagado {formatGs(p.paidGs)}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs break-all text-admin-muted">{signup}</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <a href={report} target="_blank" rel="noreferrer" className="text-admin-accent hover:underline">Página del socio →</a>
                    {p.phone ? (
                      <a href={waLink(p.phone, welcome)} target="_blank" rel="noreferrer" className="text-admin-accent hover:underline">Enviarle sus enlaces →</a>
                    ) : null}
                    <form action={updatePartnerAction} className="ml-auto flex items-end gap-2">
                      <input type="hidden" name="partnerId" value={p.id} />
                      <label className="text-xs">%<input name="commissionPct" type="number" min={0} max={100} defaultValue={p.commissionPct} className={`${input} w-20`} /></label>
                      <select name="status" defaultValue={p.status} className={`${input} w-auto`}>
                        <option value="active">Activo</option>
                        <option value="disabled">Inactivo</option>
                      </select>
                      <button type="submit" className={btn}>Guardar</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {list.length > 0 ? (
        <Card>
          <SectionTitle hint="Para el cliente de un socio que diste de alta vos desde Altas.">Asignar un sitio a un socio</SectionTitle>
          <form action={assignBusinessAction} className="flex flex-wrap items-end gap-2">
            <select name="partnerId" className={`${input} w-auto`} required>
              {list.filter((p) => p.status === "active").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select name="businessId" className={`${input} w-auto`} required>
              {unassigned.map((b) => <option key={b.id} value={b.id}>{b.name} (/{b.slug})</option>)}
            </select>
            <button type="submit" className={btn}>Asignar</button>
          </form>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Comisiones</SectionTitle>
        {commissions.length === 0 ? (
          <EmptyState title="Todavía no hay comisiones. Se crean al confirmar el pago de un cliente de un socio." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-line">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-admin-line bg-admin-surface-2 text-left text-xs tracking-wide text-admin-muted uppercase">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Socio</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 text-right font-medium">Monto</th>
                  <th className="px-3 py-2 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-b border-admin-line last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{new Date(c.createdAt).toISOString().slice(0, 10)}</td>
                    <td className="px-3 py-2">{c.partnerName}</td>
                    <td className="px-3 py-2">{c.businessName}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatGs(Number(c.amountGs))}</td>
                    <td className="px-3 py-2 text-right">
                      {c.status === "pending" ? (
                        <span className="inline-flex gap-2">
                          <form action={markCommissionPaidAction}>
                            <input type="hidden" name="commissionId" value={c.id} />
                            <button type="submit" className="rounded-md bg-admin-ok px-2.5 py-1.5 text-xs font-medium text-admin-bg">Pagada</button>
                          </form>
                          <form action={markCommissionPaidAction}>
                            <input type="hidden" name="commissionId" value={c.id} />
                            <input type="hidden" name="to" value="void" />
                            <button type="submit" className="rounded-md border border-admin-line px-2.5 py-1.5 text-xs text-admin-muted">Anular</button>
                          </form>
                        </span>
                      ) : (
                        <Badge tone={c.status === "paid" ? "ok" : "neutral"}>{c.status === "paid" ? "Pagada" : "Anulada"}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
