import { and, count, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { parseDay, todayAsuncion } from "@/lib/billing";
import { getPromoSettings } from "@/lib/settings";
import { savePromoAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Promociones" };
export default async function PromocionesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("superadmin");
  const promo = await getPromoSettings();
  const sp = await searchParams;
  const today = parseDay(todayAsuncion());
  const [active] = await db.select({ total: count() }).from(subscriptions).where(and(
    eq(subscriptions.status, "trial"), lte(subscriptions.startsAt, today), gte(subscriptions.expiresAt, today),
  ));
  const error = (field: string) => typeof sp[field] === "string" ? <p id={field + "-error"} role="alert" className="text-red-600">{sp[field]}</p> : null;
  const inputClass = "block w-full rounded border border-admin-line bg-admin-surface p-3";
  return <div className="max-w-xl space-y-5">
    <h1 className="text-xl font-semibold">Promociones</h1>
    <p>Pruebas activas actualmente: {active.total}</p>
    {sp.ok === "1" && <p role="status">Promoción guardada.</p>}
    <form action={savePromoAction} className="space-y-4">
      <label className="flex items-center gap-3"><input type="checkbox" role="switch" name="trialEnabled" defaultChecked={promo.trialEnabled} aria-describedby="trialEnabled-error" /> Activá la prueba gratis</label>
      {error("trialEnabled")}
      <label className="block">Días de prueba<input className={inputClass} type="number" name="trialDays" min={7} max={90} step={1} required defaultValue={promo.trialDays} aria-describedby="trialDays-error" /></label>
      {error("trialDays")}
      <label className="block">Plan<select className={inputClass} name="trialPlan" defaultValue={promo.trialPlan} aria-describedby="trialPlan-error"><option value="basico">Básico</option><option value="plus">Plus</option></select></label>
      {error("trialPlan")}
      <label className="block">Texto del banner<input className={inputClass} name="bannerText" maxLength={140} defaultValue={promo.bannerText} aria-describedby="bannerText-error" /></label>
      {error("bannerText")}
      <p>Al terminar la prueba, se aplica el período de gracia habitual. La promoción se ofrece solo mientras está activa.</p>
      <button type="submit" className="rounded bg-admin-text px-4 py-3 text-admin-surface">Guardar</button>
    </form>
  </div>;
}
