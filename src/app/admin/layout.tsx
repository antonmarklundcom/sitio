import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_THEME_COOKIE, parseAdminTheme } from "@/lib/admin-theme";
import { AdminThemeProvider } from "@/components/admin/theme-toggle";

export const metadata: Metadata = {
  title: { default: "sitio admin", template: "%s – sitio admin" },
  robots: { index: false, follow: false },
};

/** Yttre adminlayout: bara färg och metadata. Chromet ligger i (dashboard). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const theme = parseAdminTheme((await cookies()).get(ADMIN_THEME_COOKIE)?.value);
  return (
    <div data-admin-theme={theme ?? undefined} className="admin-theme min-h-dvh bg-admin-bg text-admin-text">
      <AdminThemeProvider theme={theme}>{children}</AdminThemeProvider>
    </div>
  );
}
