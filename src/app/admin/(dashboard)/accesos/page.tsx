import Link from "next/link";
import { listOwnerAccounts, listUnknownLoginAttempts } from "@/db/owner-queries";
import { listBusinesses } from "@/db/queries";
import { requireRole } from "@/lib/auth";
import { displayPhone } from "@/lib/format";
import { Badge, Card, EmptyState, Notice, SectionTitle } from "@/components/admin/ui";
import { OwnerCodeButton } from "@/components/admin/owner-code-button";
import { ensureOwnerAccountAction, generateOwnerCodeAction, setOwnerStatusAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accesos" };

export default async function AccesosPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireRole("superadmin");
  const sp = await searchParams;

  const [owners, unknown, allBusinesses] = await Promise.all([
    listOwnerAccounts(),
    listUnknownLoginAttempts(),
    listBusinesses({ status: "published" }),
  ]);

  const withAccount = new Set(owners.map((o) => o.businessId));
  const missingAccount = allBusinesses.filter((b) => !withAccount.has(b.id));
  const waiting = owners.filter((o) => o.requestedAt && !o.pendingCode);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Accesos</h1>
        <p className="mt-1 text-sm text-admin-muted">
          El dueño inicia sesión en /mi-sitio con un código que enviás desde tu propio WhatsApp. El código se muestra una sola vez y
          nunca se guarda como texto legible. Se automatiza en PR-17.
        </p>
      </div>

      {sp.ok ? <Notice tone="ok">{sp.ok}</Notice> : null}

      {waiting.length > 0 ? (
        <Notice tone="warn">
          {waiting.length} cliente{waiting.length === 1 ? "" : "s"} en espera de un código:{" "}
          {waiting.map((w) => w.businessName).join(", ")}.
        </Notice>
      ) : null}

      {missingAccount.length > 0 ? (
        <Card>
          <SectionTitle hint="La cuenta se crea automáticamente al publicar. Estos sitios se publicaron antes de que existiera el acceso de dueños o no tienen un número verificado.">
            Sitios publicados sin cuenta de dueño
          </SectionTitle>
          <ul className="space-y-2">
            {missingAccount.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 text-sm">
                <Link href={`/admin/sitios/${b.id}`} className="font-medium hover:text-admin-accent">
                  {b.name}
                </Link>
                {b.whatsappVerifiedAt ? (
                  <Badge tone="ok">Número verificado</Badge>
                ) : (
                  <Badge tone="warn">Número sin verificar</Badge>
                )}
                <form action={ensureOwnerAccountAction} className="ml-auto">
                  <input type="hidden" name="businessId" value={b.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-admin-line px-2.5 py-1.5 text-xs hover:border-admin-muted"
                  >
                    Crear cuenta
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <SectionTitle hint="El código dura 10 minutos y permite cinco intentos.">Cuentas de dueños</SectionTitle>

        {owners.length === 0 ? (
          <EmptyState title="Todavía no hay cuentas de dueños. Se crean al publicar un sitio." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-line">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-admin-line bg-admin-surface-2 text-left text-xs tracking-wide text-admin-muted uppercase">
                  <th className="px-3 py-2 font-medium">Sitio</th>
                  <th className="px-3 py-2 font-medium">Número</th>
                  <th className="px-3 py-2 font-medium">Último acceso</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 text-right font-medium">Código</th>
                  <th className="px-3 py-2 text-right font-medium">Cuenta</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.userId} className="border-b border-admin-line last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/admin/sitios/${o.businessId}`} className="font-medium hover:text-admin-accent">
                        {o.businessName}
                      </Link>
                      <span className="block font-mono text-xs text-admin-muted">/{o.slug}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{o.phone ? displayPhone(o.phone) : "—"}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-admin-muted">
                      {o.lastLoginAt ? new Date(o.lastLoginAt).toLocaleString("sv-SE") : "Nunca"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {o.status === "active" ? <Badge tone="ok">Activa</Badge> : <Badge tone="danger">Desactivada</Badge>}
                        {o.pendingCode ? <Badge tone="warn">Código enviado</Badge> : null}
                        {o.requestedAt && !o.pendingCode ? <Badge tone="warn">En espera de código</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {o.status === "active" ? (
                        <OwnerCodeButton
                          action={generateOwnerCodeAction.bind(null, o.userId)}
                          businessName={o.businessName}
                          phone={o.phone ?? ""}
                        />
                      ) : (
                        <span className="text-xs text-admin-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <form action={setOwnerStatusAction}>
                        <input type="hidden" name="userId" value={o.userId} />
                        <input type="hidden" name="status" value={o.status === "active" ? "disabled" : "active"} />
                        <button
                          type="submit"
                          className="rounded-md border border-admin-line px-2.5 py-1.5 text-xs text-admin-muted hover:text-admin-text"
                        >
                          {o.status === "active" ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {unknown.length > 0 ? (
        <Card>
          <SectionTitle hint="Números que solicitaron un código pero no pertenecen a ninguna cuenta de dueño. Suelen ser números incorrectos, pero conviene revisar si se acumulan.">
            Intentos de acceso desconocidos (24 h)
          </SectionTitle>
          <ul className="space-y-1 text-sm text-admin-muted">
            {unknown.map((row) => {
              const meta = (row.metaJson ?? {}) as { phone?: string };
              return (
                <li key={row.id} className="flex justify-between gap-4">
                  <span className="font-mono">{meta.phone ? displayPhone(meta.phone) : "desconocido"}</span>
                  <span className="text-xs">{new Date(row.createdAt).toLocaleString("sv-SE")}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
