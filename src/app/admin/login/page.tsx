import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Logga in – sitio admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const user = await currentUser();
  if (user?.role === "superadmin") redirect("/admin");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-admin-bg px-6 py-16 text-admin-text">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="font-mono text-sm tracking-widest text-admin-muted">sitio.com.py</p>
          <h1 className="mt-2 text-2xl font-semibold">Admin</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
