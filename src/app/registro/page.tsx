import { getPromoSettings } from "@/lib/settings";
import { PLAN_LABELS } from "@/lib/billing";
import { RegistroForm } from "@/components/registro/registro-form";
import { registerAction } from "./actions";
import { normalizeRefCode } from "@/lib/growth";

export const revalidate = 60;

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const promo = await getPromoSettings().catch(() => null);
  // Värvningskoden följer med som dolt fält; den löses först i åtgärden.
  const ref = normalizeRefCode((await searchParams).ref) ?? "";
  return (
    <main className="panel-wrap" lang="es-PY">
      <span className="panel-brand">sitio.com.py</span>
      <h1>Creá tu página en sitio.com.py</h1>
      {promo?.trialEnabled && <p data-testid="promo-offer">Probá {PLAN_LABELS[promo.trialPlan]} gratis {promo.trialDays} días</p>}
      <p>Te lleva 5 minutos desde el celular; después completás las fotos y los detalles.</p>
      <p>En el próximo paso verificás tu número con un código por WhatsApp.</p>
      {ref ? <p data-testid="ref-offer">Te recomendó un negocio amigo: al pagar tu primer año sumás días extra gratis.</p> : null}
      <RegistroForm action={registerAction} refCode={ref} />
    </main>
  );
}
