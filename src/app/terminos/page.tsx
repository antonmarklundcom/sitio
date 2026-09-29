import Link from "next/link";
import { formatGs } from "@/lib/format";
import { GRACE_DAYS, PLAN_LABELS, PLAN_SUGGESTED_PRICE_GS } from "@/lib/billing";
import { LegalContact, LegalPage, legalMetadata } from "@/components/legal/legal-page";

const TITLE = "Términos y condiciones | sitio.com.py";
const DESCRIPTION =
  "Condiciones del servicio de sitio.com.py: planes, precios, prueba gratis, pago, renovación, contenido y responsabilidad.";

export const metadata = legalMetadata("/terminos", TITLE, DESCRIPTION);

export default function TerminosPage() {
  const basico = formatGs(PLAN_SUGGESTED_PRICE_GS.basico);
  const plus = formatGs(PLAN_SUGGESTED_PRICE_GS.plus);

  return (
    <LegalPage title="Términos y condiciones" lede="Estas son las reglas del servicio de sitio.com.py. Si algo no queda claro, escribinos por WhatsApp.">
      <h2>1. El servicio</h2>
      <p>
        sitio.com.py arma páginas de una sola pantalla para negocios de Paraguay, pensadas para que
        el cliente te escriba por WhatsApp. Cada negocio tiene su página publicada en
        sitio.com.py/[slug], con sus datos, fotos, horario y mapa. Al registrarte o pedir tu
        página aceptás estos términos.
      </p>

      <h2>2. Planes y precios</h2>
      <ul>
        <li>{PLAN_LABELS.basico}: {basico} por año.</li>
        <li>{PLAN_LABELS.plus}: {plus} por año.</li>
      </ul>
      <p>
        Son precios de referencia en guaraníes. El precio acordado con cada cliente se confirma por
        WhatsApp antes de pagar y es el que figura en su suscripción.
      </p>

      <h2>3. Prueba gratis</h2>
      <p>
        Cuando hay una promoción activa, podés probar un plan sin pagar durante el tiempo que se
        indique en la página de registro. Al terminar la prueba, la página sigue publicada solo si
        pagás el plan; si no, se pausa.
      </p>

      <h2>4. Pago</h2>
      <p>
        El pago es manual: por transferencia, giros o Tigo Money (también podemos aceptar otros
        medios que te indiquemos por WhatsApp). Después de pagar, enviás el comprobante por
        WhatsApp y confirmamos el pago a mano. La suscripción dura un año desde la fecha que figura
        en el comprobante confirmado.
      </p>

      <h2>5. Renovación y pausa por falta de pago</h2>
      <p>
        Antes del vencimiento te avisamos por WhatsApp para renovar. Si pasa la fecha de
        vencimiento, tu página sigue publicada durante {GRACE_DAYS} días de gracia. Pasado ese
        plazo sin pago, la página se pausa y deja de ser visible hasta que renueves. Al pagar, se
        vuelve a publicar.
      </p>

      <h2>6. Tu contenido</h2>
      <ul>
        <li>Los textos, fotos, logos y demás datos de tu negocio son tuyos.</li>
        <li>
          Vos sos responsable de que lo que publicás sea verdadero, legal y que tengas derecho a
          usarlo (por ejemplo, que las fotos y marcas no sean de terceros sin permiso).
        </li>
        <li>Nos das permiso para mostrar ese contenido en tu página mientras el servicio esté activo.</li>
      </ul>

      <h2>7. Retiro de una página</h2>
      <p>
        Podemos pausar o retirar una página que incumpla estos términos, tenga contenido ilegal,
        engañoso u ofensivo, o infrinja derechos de terceros, con o sin aviso previo cuando sea
        necesario. Vos también podés pedir en cualquier momento que retiremos tu página, escribiéndonos
        por WhatsApp.
      </p>

      <h2>8. Limitación de responsabilidad</h2>
      <p>
        Hacemos lo posible para que tu página esté disponible, pero no garantizamos que funcione
        sin interrupciones ni que genere una cantidad determinada de visitas, consultas o ventas.
        En la medida permitida por la ley, nuestra responsabilidad total por cualquier reclamo
        relacionado con el servicio se limita al monto que pagaste por el año en curso. No
        respondemos por lucro cesante ni por daños indirectos.
      </p>

      <h2>9. Datos personales</h2>
      <p>
        El tratamiento de datos se explica en la <Link href="/privacidad">Política de Privacidad</Link>.
      </p>

      <h2>10. Cambios</h2>
      <p>
        Podemos actualizar estos términos. La fecha de la última actualización figura arriba. Si el
        cambio te afecta de forma importante, te avisamos por WhatsApp.
      </p>

      <h2>11. Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de la República del Paraguay. Cualquier conflicto se
        somete a los tribunales competentes de Asunción.
      </p>

      <h2>12. Contacto</h2>
      <p>
        Escribinos por <LegalContact label="WhatsApp" />.
      </p>
    </LegalPage>
  );
}
