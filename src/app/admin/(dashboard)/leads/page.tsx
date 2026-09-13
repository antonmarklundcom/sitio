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
          {leads.length} sajter · {hotCount} hot lead{hotCount === 1 ? "" : "s"} · poäng räknas nattligen av cron-jobbet
        </p>
      </div>

      <Card>
        <SectionTitle hint="Poängen (upsellScore) räknas nattligen från trafik, moduler och betalningsstatus — se plan §6.3. En hot lead är en sajt som redan visar köpsignaler, oavsett poäng.">
          Sajter, poäng-sorterade
        </SectionTitle>

        {leads.length === 0 ? (
          <EmptyState title="Inga sajter ännu." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-line">
            <table className="w-full min-w-[64rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-admin-line bg-admin-surface-2 text-left text-xs tracking-wide text-admin-muted uppercase">
                  <th className="px-3 py-2 font-medium">Sajt</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-3 py-2 text-right font-medium" title="Besök senaste 30 dygnen">
                    Besök 30d
                  </th>
                  <th className="px-3 py-2 text-right font-medium" title="WhatsApp-klick senaste 30 dygnen">
                    WA 30d
                  </th>
                  <th className="px-3 py-2 font-medium">Stadium</th>
                  <th className="px-3 py-2 font-medium">Anteckning</th>
                  <th className="px-3 py-2 text-right font-medium">Pitch</th>
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
