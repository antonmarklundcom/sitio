import { requireRole } from "@/lib/auth";
import { listLeads } from "@/db/lead-queries";
import { Card, EmptyState, SectionTitle } from "@/components/admin/ui";
import { LeadsRow } from "@/components/admin/leads-row";

export const dynamic = "force-dynamic";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  await requireRole("superadmin");
  const leads = await listLeads();
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
