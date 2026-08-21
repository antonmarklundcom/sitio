import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { OwnerLoginForm } from "./login-form";
import { requestOwnerCodeAction, verifyOwnerCodeAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi sitio — entrar", robots: { index: false, follow: false } };

export default async function OwnerLoginPage() {
  const user = await currentUser();
  if (user?.role === "owner") redirect("/mi-sitio");

  return (
    <div className="panel-wrap">
      <span className="panel-brand">sitio.com.py</span>
      <h1>Mi sitio</h1>
      <p>Acá cambiás los textos, las fotos y el horario de tu página. Y ves cuánta gente la visita.</p>
      <OwnerLoginForm requestCode={requestOwnerCodeAction} verifyCode={verifyOwnerCodeAction} />
    </div>
  );
}
