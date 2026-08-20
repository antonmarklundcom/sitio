import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { logoutAction } from "../login/actions";

// Hot leads (PR-16) läggs till när vyn finns — en meny som pekar på 404 är
// värre än en kort meny.
const NAV = [
  { href: "/admin", label: "Sajter" },
  { href: "/admin/pagos", label: "Cobros" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("superadmin");

  return (
    <>
      <header className="border-b border-admin-line bg-admin-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <Link href="/admin" className="font-mono text-sm tracking-widest text-admin-muted">
            sitio.com.py
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-1.5 text-admin-muted transition-colors hover:bg-admin-surface-2 hover:text-admin-text"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-admin-muted">{user.name}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md px-2.5 py-1.5 text-admin-muted transition-colors hover:text-admin-text"
              >
                Logga ut
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </>
  );
}
