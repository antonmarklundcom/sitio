import { requireRole } from "@/lib/auth";
import { listLeads } from "@/db/lead-queries";
import { Card, EmptyState, SectionTitle } from "@/components/admin/ui";
import { LeadsRow } from "@/components/admin/leads-row";
import { Badge } from "@/components/admin/ui";
import { listServiceRequests } from "@/db/growth-queries";
import { waLink } from "@/lib/format";
import { setServiceRequestStatusAction } from "./actions";

const REQUEST_LABELS: Record<string, string> = { nuevo: "Nuevo", contactado: "Contactado", vendido: "Vendido", descartado: "Descartado" };

export const dynamic = "force-dynamic";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  await requireRole("superadmin");
  const [leads, requests] = await Promise.all([listLeads(), listServiceRequests()]);
  const openRequests = requests.filter((r) => r.status === "nuevo" || r.status === "contactado").length;
  const hotCount = leads.filter((l) => l.hotLead).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="mt-1 text-sm text-admin-muted">
          {leads.length} sitios · {hotCount} lead{hotCount === 1 ? " con alto interés" : "s con alto interés"} · el puntaje se calcula cada noche con la tarea cron
        </p>
      </div>

      <Card>
        <SectionTitle hint="Clientes que tocaron “Me interesa” en su panel (Hacé crecer tu negocio). Es la venta más caliente que tenés: ya levantaron la mano.">
          Pedidos de servicios ({openRequests} abiertos)
        </SectionTitle>
        {requests.length === 0 ? (
          <EmptyState title="Todavía nadie pidió un servicio. El catálogo se edita en Crecimiento." />
        ) : (
          <ul className="space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-admin-line p-2">
                <a href={`/admin/sitios/${r.businessId}`} className="font-medium hover:text-admin-accent">{r.businessName}</a>
                <span>{r.serviceTitle}</span>
                <Badge tone={r.status === "nuevo" ? "warn" : r.status === "vendido" ? "ok" : "neutral"}>{REQUEST_LABELS[r.status]}</Badge>
                <span className="font-mono text-xs text-admin-muted">{new Date(r.createdAt).toISOString().slice(0, 10)}</span>
                <a
                  href={waLink(r.whatsappPhone, `Hola ${r.businessName}! Vi que te interesa “${r.serviceTitle}”. ¿Tenés 5 minutos para que te cuente?`)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-admin-accent hover:underline"
                >
                  WhatsApp →
                </a>
                <form action={setServiceRequestStatusAction} className="ml-auto flex gap-1">
                  <input type="hidden" name="requestId" value={r.id} />
                  <select name="status" defaultValue={r.status} className="rounded-md border border-admin-line bg-admin-surface px-2 py-1 text-xs">
                    {Object.entries(REQUEST_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button type="submit" className="rounded-md border border-admin-line px-2 py-1 text-xs">OK</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle hint="El puntaje (upsellScore) se calcula cada noche a partir del tráfico, los módulos y el estado de pago — ver plan §6.3. Un lead con alto interés es un sitio que ya muestra señales de compra, sin importar su puntaje.">
          Sitios ordenados por puntaje
        </SectionTitle>

        {leads.length === 0 ? (
          <EmptyState title="Todavía no hay sitios." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-line">
            <table className="w-full min-w-[64rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-admin-line bg-admin-surface-2 text-left text-xs tracking-wide text-admin-muted uppercase">
                  <th className="px-3 py-2 font-medium">Sitio</th>
                  <th className="px-3 py-2 text-right font-medium">Puntaje</th>
                  <th className="px-3 py-2 text-right font-medium" title="Visitas en los últimos 30 días">
                    Visitas, 30 días
                  </th>
                  <th className="px-3 py-2 text-right font-medium" title="Clics en WhatsApp en los últimos 30 días">
                    WA, 30 días
                  </th>
                  <th className="px-3 py-2 font-medium">Etapa</th>
                  <th className="px-3 py-2 font-medium">Nota</th>
                  <th className="px-3 py-2 text-right font-medium">Propuesta</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <LeadsRow key={lead.id} lead={lead} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
