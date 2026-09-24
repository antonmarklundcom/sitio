import Link from "next/link";
import { getGrowthSettings, getUpsellCatalog, listNeedsReview } from "@/db/growth-queries";
import { requireRole } from "@/lib/auth";
import { Card, EmptyState, Notice, SectionTitle } from "@/components/admin/ui";
import { markReviewedAction, saveGrowthSettingsAction, saveUpsellCatalogAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Crecimiento" };

const input = "block w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2";
const btn = "rounded-md bg-admin-text px-4 py-2 text-sm text-admin-surface";

export default async function CrecimientoPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireRole("superadmin");
  const sp = await searchParams;
  const [settings, catalog, review] = await Promise.all([getGrowthSettings(), getUpsellCatalog(), listNeedsReview()]);
  const rows = [...catalog, ...Array.from({ length: Math.max(0, Math.min(2, 12 - catalog.length)) }, () => null)];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Crecimiento</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Recomendaciones, comisiones, publicación automática y los servicios que tus clientes ven en su panel.
        </p>
      </div>
      {sp.ok ? <Notice tone="ok">{sp.ok}</Notice> : null}
      {sp.error ? <Notice tone="danger">{sp.error}</Notice> : null}

      <Card>
        <SectionTitle hint="Publicados solos al terminar el alta. Revisalos y marcalos; si algo está mal, pausalo desde el sitio.">
          Para revisar ({review.length})
        </SectionTitle>
        {review.length === 0 ? (
          <EmptyState title="Nada para revisar." />
        ) : (
          <ul className="space-y-2 text-sm">
            {review.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3">
                <Link href={`/admin/sitios/${b.id}`} className="font-medium hover:text-admin-accent">{b.name}</Link>
                <a href={`/${b.slug}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-admin-accent">/{b.slug} →</a>
                <form action={markReviewedAction} className="ml-auto">
                  <input type="hidden" name="businessId" value={b.id} />
                  <button type="submit" className="rounded-md bg-admin-ok px-2.5 py-1.5 text-xs font-medium text-admin-bg">Revisado</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Ajustes</SectionTitle>
        <form action={saveGrowthSettingsAction} className="grid max-w-2xl gap-4 sm:grid-cols-3">
          <label className="text-sm">Días para quien recomienda<input className={input} type="number" name="referralRewardDays" min={0} max={365} defaultValue={settings.referralRewardDays} /></label>
          <label className="text-sm">Días para el recomendado<input className={input} type="number" name="referredBonusDays" min={0} max={365} defaultValue={settings.referredBonusDays} /></label>
          <label className="text-sm">Comisión por defecto de socios (%)<input className={input} type="number" name="partnerCommissionPct" min={0} max={100} defaultValue={settings.partnerCommissionPct} /></label>
          <label className="flex items-start gap-3 text-sm sm:col-span-3">
            <input type="checkbox" name="autoPublish" defaultChecked={settings.autoPublish} className="mt-1" />
            <span>
              <strong>Publicación automática.</strong> Cuando un cliente termina el alta, los textos se mejoran con IA (si hay
              ANTHROPIC_API_KEY) y la página se publica en el momento, sin esperar tu revisión. Queda en “Para revisar”.
              La prueba gratis empieza al publicar, en cualquier caso.
            </span>
          </label>
          <div className="sm:col-span-3"><button type="submit" className={btn}>Guardar ajustes</button></div>
        </form>
        <p className="mt-3 text-sm text-admin-muted">
          Los días se suman al plan de ambos cuando el recomendado confirma su primer pago. Una sola vez por cliente.
        </p>
      </Card>

      <Card>
        <SectionTitle hint="Lo que tus clientes ven en “Hacé crecer tu negocio” en /mi-sitio. “Me interesa” te llega en Leads y te abre WhatsApp con el cliente. Borrá el título para quitar una fila.">
          Servicios para ofrecer
        </SectionTitle>
        <form action={saveUpsellCatalogAction} className="space-y-4">
          <input type="hidden" name="rows" value={rows.length} />
          {rows.map((s, i) => (
            <fieldset key={s?.key ?? `new-${i}`} className="grid gap-2 rounded-lg border border-admin-line p-3 sm:grid-cols-6">
              <label className="text-xs sm:col-span-1">Clave<input className={input} name={`key.${i}`} defaultValue={s?.key ?? ""} placeholder="seo-local" /></label>
              <label className="text-xs sm:col-span-3">Título<input className={input} name={`title.${i}`} defaultValue={s?.title ?? ""} maxLength={120} /></label>
              <label className="text-xs sm:col-span-2">Precio (texto)<input className={input} name={`price.${i}`} defaultValue={s?.price ?? ""} maxLength={60} placeholder="Desde ₲ 500.000" /></label>
              <label className="text-xs sm:col-span-5">Descripción<input className={input} name={`body.${i}`} defaultValue={s?.body ?? ""} maxLength={300} /></label>
              <label className="flex items-center gap-2 self-end text-xs"><input type="checkbox" name={`enabled.${i}`} defaultChecked={s?.enabled ?? true} /> Visible</label>
            </fieldset>
          ))}
          <button type="submit" className={btn}>Guardar catálogo</button>
        </form>
      </Card>
    </div>
  );
}
