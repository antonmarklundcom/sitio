import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { changePasswordAction } from "./actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; guardada?: string }> }) {
  const session = await requireRole("superadmin");
  const [user] = await db.select({ email: users.email }).from(users).where(and(
    eq(users.id, session.userId), eq(users.role, "superadmin"), eq(users.status, "active"),
  )).limit(1);
  const query = await searchParams;
  return (
    <section className="mx-auto w-full max-w-sm text-admin-text">
      <h1 className="mb-2 text-2xl font-semibold">Mi cuenta</h1>
      <p className="mb-8 break-all text-sm text-admin-muted">Correo: {user?.email ?? "No disponible"}</p>
      {query.guardada === "1" && <p role="status" className="mb-4 text-sm">Tu contraseña se cambió.</p>}
      <form action={changePasswordAction} className="space-y-4">
        <div><label htmlFor="current" className="mb-1.5 block text-sm text-admin-muted">Contraseña actual</label><input id="current" name="current" type="password" autoComplete="current-password" required className="w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:border-admin-accent" /></div>
        <p className="text-sm text-admin-muted">Usá al menos 10 caracteres y hasta 72 bytes.</p>
        <div><label htmlFor="password" className="mb-1.5 block text-sm text-admin-muted">Nueva contraseña</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:border-admin-accent" /></div>
        <div><label htmlFor="repeat" className="mb-1.5 block text-sm text-admin-muted">Repetí la nueva contraseña</label><input id="repeat" name="repeat" type="password" autoComplete="new-password" required minLength={10} className="w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:border-admin-accent" /></div>
        {query.error && <p role="alert" className="text-sm text-admin-danger">{query.error === "current" ? "La contraseña actual no es correcta. Probá de nuevo." : query.error === "repeat" ? "Las contraseñas no coinciden. Revisalas." : "Usá una contraseña de al menos 10 caracteres y hasta 72 bytes."}</p>}
        <button type="submit" className="w-full rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">Cambiá tu contraseña</button>
      </form>
    </section>
  );
}

