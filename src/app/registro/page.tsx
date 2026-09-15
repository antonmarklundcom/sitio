import { RegistroForm } from "@/components/registro/registro-form";
import { registerAction } from "./actions";

export default function RegistroPage() {
  return (
    <main className="panel-wrap" lang="es-PY">
      <span className="panel-brand">sitio.com.py</span>
      <h1>Creá tu página en sitio.com.py</h1>
      <p>Te lleva 5 minutos desde el celular; después completás las fotos y los detalles.</p>
      <p>En el próximo paso verificás tu número con un código por WhatsApp.</p>
      <RegistroForm action={registerAction} />
    </main>
  );
}
