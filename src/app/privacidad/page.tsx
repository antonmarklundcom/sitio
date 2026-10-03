import Link from "next/link";
import { LegalContact, LegalPage, legalMetadata } from "@/components/legal/legal-page";

const TITLE = "Política de privacidad | sitio.com.py";
const DESCRIPTION =
  "Qué datos recolecta sitio.com.py, para qué se usan, dónde se guardan, cuánto tiempo y cómo pedir que los borremos.";

export const metadata = legalMetadata("/privacidad", TITLE, DESCRIPTION);

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad" lede="Acá explicamos qué datos guardamos, para qué, y cómo pedirnos que los borremos.">
      <h2>1. Datos de dueños de negocios</h2>
      <p>Cuando creás tu página con nosotros, guardamos:</p>
      <ul>
        <li>nombre del negocio, rubro y ciudad;</li>
        <li>tu número de teléfono / WhatsApp;</li>
        <li>tu correo electrónico, si lo cargás o lo usamos para tu cuenta;</li>
        <li>las fotos, textos, horarios y demás datos que cargues para tu página;</li>
        <li>los registros de pagos de tu suscripción (monto, medio y referencia).</li>
      </ul>
      <p>
        Los usamos para armar y publicar tu página, contactarte, cobrar y renovar el servicio.
        Parte de lo que cargás (por ejemplo la descripción y los servicios) se publica en tu
        página, que es pública. Si usás la opción de mejorar textos con inteligencia artificial,
        esos textos del negocio se envían al proveedor de IA (Anthropic) solo para generar la
        propuesta.
      </p>

      <h2>2. Datos de visitantes: formulario de consulta</h2>
      <p>
        Si la página de un negocio tiene formulario de consulta o de turno y lo completás,
        guardamos lo que escribís: tu nombre, tu teléfono, el mensaje y, en el caso de un turno,
        el servicio, el día y la hora pedidos. Esos datos los ve el negocio al que le escribiste y
        el equipo de sitio.com.py que administra el servicio. Se usan solo para que el negocio
        pueda responderte.
      </p>

      <h2>3. Estadísticas anónimas</h2>
      <p>
        Las páginas registran visitas y toques en botones (WhatsApp, llamada, mapa, redes,
        menú o galería) para mostrarle al dueño cuánta gente lo visita. Por cada evento
        guardamos: la página visitada, qué botón se tocó, el sitio de origen (solo el dominio, no
        la dirección completa), el tipo de dispositivo (celular, computadora u otro) y un código
        aleatorio que combina tu IP y navegador con una sal que cambia todos los días. Ese código
        no permite identificarte ni seguirte de un día a otro. No guardamos tu dirección IP ni
        tu navegador en texto.
      </p>

      <h2>4. Dónde se guardan y quién los ve</h2>
      <p>
        Los datos se guardan en servidores de Hostinger. Tienen acceso el equipo de sitio.com.py
        y, en el caso de las consultas de visitantes, el dueño del negocio correspondiente.
        Usamos proveedores para enviar correos (Cloudflare) y, si se usa la mejora de textos,
        Anthropic, solo para esa función.
      </p>

      <h2>5. No vendemos datos</h2>
      <p>No vendemos ni alquilamos datos personales a nadie.</p>

      <h2>6. Cuánto tiempo los guardamos</h2>
      <ul>
        <li>Datos del negocio y de la suscripción: mientras tengas el servicio y el tiempo necesario para cumplir obligaciones legales y contables.</li>
        <li>Consultas de visitantes: mientras el negocio las conserve, hasta que se borren o nos pidas eliminarlas.</li>
        <li>Eventos de estadísticas sin procesar: hasta 396 días; después quedan solo totales diarios sin datos personales.</li>
      </ul>

      <h2>7. Cómo pedir que borremos tus datos</h2>
      <p>
        Escribinos por <LegalContact label="WhatsApp" /> indicando tu nombre y el negocio o número
        que dejaste, y borramos o corregimos tus datos. Podemos pedirte que confirmes que sos la
        persona que los dejó.
      </p>

      <h2>8. Cambios</h2>
      <p>Si cambiamos esta política, actualizamos la fecha de arriba. Ver también los <Link href="/terminos">Términos</Link>.</p>
    </LegalPage>
  );
}
