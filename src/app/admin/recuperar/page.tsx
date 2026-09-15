import Link from "next/link";
import { recoverAction } from "./actions";

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ enviado?: string; invalido?: string }> }) {
  const query = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-admin-bg px-6 py-16 text-admin-text">
      <div className="w-full max-w-sm">
        <div className="mb-8"><p className="font-mono text-sm tracking-widest text-admin-muted">sitio.com.py</p><h1 className="mt-2 text-2xl font-semibold">Recuperá tu contraseña</h1></div>
        {query.enviado === "1" && <p role="status" className="mb-4 text-sm">Si el correo corresponde a una cuenta, vas a recibir un enlace para restablecer tu contraseña.</p>}
        {query.invalido === "1" && <p role="alert" className="mb-4 text-sm text-admin-danger">El enlace no es válido o venció. Pedí uno nuevo.</p>}
        <form action={recoverAction} className="space-y-4">
          <div><label htmlFor="email" className="mb-1.5 block text-sm text-admin-muted">Correo</label><input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:border-admin-accent" /></div>
          <button type="submit" className="w-full rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">Enviá el enlace</button>
        </form>
        <Link href="/admin/login" className="mt-4 block text-sm text-admin-accent hover:underline">Volvé a iniciar sesión</Link>
      </div>
    </main>
  );
}

