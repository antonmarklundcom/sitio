import { getPromoSettings } from "@/lib/settings";
import { PLAN_LABELS } from "@/lib/billing";
import { RegistroForm } from "@/components/registro/registro-form";
import { registerAction } from "./actions";

export const revalidate = 60;

export default async function RegistroPage() {
  const promo = await getPromoSettings().catch(() => null);
  return (
    <main className="panel-wrap" lang="es-PY">
      <span className="panel-brand">sitio.com.py</span>
      <h1>Creá tu página en sitio.com.py</h1>
      {promo?.trialEnabled && <p data-testid="promo-offer">Probá {PLAN_LABELS[promo.trialPlan]} gratis {promo.trialDays} días</p>}
      <p>Te lleva 5 minutos desde el celular; después completás las fotos y los detalles.</p>
      <p>En el próximo paso verificás tu número con un código por WhatsApp.</p>
      <RegistroForm action={registerAction} />
    </main>
  );
}
