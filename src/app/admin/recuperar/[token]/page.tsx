import Link from "next/link";
import { findActiveSuperadminByEmail } from "@/lib/auth";
import { passwordVersion, verifyResetToken } from "@/lib/password-reset";
import { resetAction } from "./actions";

export default async function ResetPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const signed = verifyResetToken(token, Date.now());
  // En använd länk (lösenordet har bytts sedan dess) visas som ogiltig direkt,
  // inte först efter att man skrivit ett nytt lösenord (R3-37).
  const user = signed ? await findActiveSuperadminByEmail(signed.email) : null;
  const claims = signed && user?.id === signed.userId && passwordVersion(user.passwordHash) === signed.pv ? signed : null;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-admin-bg px-6 py-16 text-admin-text">
      <div className="w-full max-w-sm">
        <div className="mb-8"><p className="font-mono text-sm tracking-widest text-admin-muted">sitio.com.py</p><h1 className="mt-2 text-2xl font-semibold">Restablecé tu contraseña</h1></div>
        {!claims ? <p role="alert" className="text-sm text-admin-danger">El enlace no es válido o venció. Pedí uno nuevo.</p> : (
          <form action={resetAction.bind(null, token)} className="space-y-4">
            <p className="text-sm text-admin-muted">Usá al menos 10 caracteres y hasta 72 bytes.</p>
            <div><label htmlFor="password" className="mb-1.5 block text-sm text-admin-muted">Nueva contraseña</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:border-admin-accent" /></div>
            <div><label htmlFor="repeat" className="mb-1.5 block text-sm text-admin-muted">Repetí la nueva contraseña</label><input id="repeat" name="repeat" type="password" autoComplete="new-password" required minLength={10} className="w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:border-admin-accent" /></div>
            {error && <p role="alert" className="text-sm text-admin-danger">{error === "repeat" ? "Las contraseñas no coinciden. Revisalas." : "Usá una contraseña de al menos 10 caracteres y hasta 72 bytes."}</p>}
            <button type="submit" className="w-full rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">Restablecé tu contraseña</button>
          </form>
        )}
        <Link href="/admin/recuperar" className="mt-4 block text-sm text-admin-accent hover:underline">Pedí otro enlace</Link>
      </div>
    </main>
  );
}

