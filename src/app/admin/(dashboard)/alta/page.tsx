import Link from "next/link";
import { listIntakeLinks } from "@/db/intake-queries";
import { requireRole } from "@/lib/auth";
import { absoluteUrl } from "@/lib/env";
import { displayPhone, waLink } from "@/lib/format";
import { STATUS_LABELS, type BusinessStatus } from "@/lib/business";
import { TOKEN_TTL_DAYS } from "@/lib/intake";
import { Badge, Card, EmptyState, Notice, SectionTitle, StatusBadge } from "@/components/admin/ui";
import { CopyLink, CreateIntakeLinkForm, OtpButton } from "@/components/admin/intake-admin";
import { createIntakeLinkAction, generateOtpAction, revokeIntakeLinkAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intake" };

export default async function IntakeAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  await requireRole("superadmin");
  const sp = await searchParams;
  const links = await listIntakeLinks();
  const now = Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Intake-länkar</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Kunden fyller i sina uppgifter på /alta/&lt;token&gt;. Länken gäller {TOKEN_TTL_DAYS} dagar och stängs
          när formuläret skickas in.
        </p>
      </div>

      {sp.ok ? <Notice tone="ok">{sp.ok}</Notice> : null}

      <CreateIntakeLinkForm action={createIntakeLinkAction} />

      <Card>
        <SectionTitle hint="Koden skickar du från din egen WhatsApp tills Cloud API finns (PR-17). Den visas en gång och lagras aldrig i klartext.">
          Länkar
        </SectionTitle>

        {links.length === 0 ? (
          <EmptyState title="Inga intake-länkar ännu." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-line">
            <table className="w-full min-w-[54rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-admin-line bg-admin-surface-2 text-left text-xs tracking-wide text-admin-muted uppercase">
                  <th className="px-3 py-2 font-medium">Sajt</th>
                  <th className="px-3 py-2 font-medium">Länk</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">WhatsApp</th>
                  <th className="px-3 py-2 text-right font-medium">Kod</th>
                  <th className="px-3 py-2 text-right font-medium">Åtgärd</th>
                </tr>
              </thead>
              <tbody>
                {links.map((row) => {
                  const url = absoluteUrl(`/alta/${row.token}`);
                  const expired = row.expiresAt.getTime() < now;
                  const shareHref = row.phone
                    ? waLink(
                        row.phone,
                        `Hola! Te paso el link para cargar los datos de tu página: ${url} — cualquier duda, escribime por acá.`,
                      )
                    : null;

                  return (
                    <tr key={row.id} className="border-b border-admin-line last:border-0">
                      <td className="px-3 py-2">
                        <Link href={`/admin/sitios/${row.businessId}`} className="font-medium hover:text-admin-accent">
                          {row.businessName}
                        </Link>
                        <span className="block text-xs text-admin-muted">
                          Skapad {row.createdAt.toLocaleDateString("sv-SE")}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col items-start gap-1">
                          <CopyLink url={url} />
                          {shareHref ? (
                            <a href={shareHref} target="_blank" rel="noreferrer" className="text-xs text-admin-accent hover:underline">
                              Dela på WhatsApp →
                            </a>
                          ) : (
                            <span className="text-xs text-admin-muted">Inget nummer sparat</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={row.businessStatus as BusinessStatus} />
                          {row.usedAt ? (
                            <Badge tone="ok">Inskickad</Badge>
                          ) : expired ? (
                            <Badge tone="danger">Utgången</Badge>
                          ) : (
                            <Badge tone="warn">Öppen</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {row.verifiedAt ? (
                          <Badge tone="ok">Verifierad</Badge>
                        ) : row.pendingCode ? (
                          <Badge tone="warn">Kod skickad</Badge>
                        ) : (
                          <Badge tone="neutral">Overifierad</Badge>
                        )}
                        {row.phone ? (
                          <span className="mt-0.5 block text-xs text-admin-muted">{displayPhone(row.phone)}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.verifiedAt ? (
                          <span className="text-xs text-admin-muted">—</span>
                        ) : (
                          <OtpButton
                            action={generateOtpAction.bind(null, row.businessId)}
                            businessName={row.businessName}
                            phone={row.phone ?? ""}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.usedAt || expired ? (
                          <span className="text-xs text-admin-muted">
                            {row.usedAt ? STATUS_LABELS[row.businessStatus as BusinessStatus] : "Stängd"}
                          </span>
                        ) : (
                          <form action={revokeIntakeLinkAction}>
                            <input type="hidden" name="tokenId" value={row.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-admin-line px-2.5 py-1.5 text-xs text-admin-muted hover:text-admin-danger"
                            >
                              Stäng
                            </button>
                          </form>
                        )}
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
