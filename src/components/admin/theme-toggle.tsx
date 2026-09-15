"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { setAdminTheme } from "@/app/admin/theme-actions";
import type { AdminTheme } from "@/lib/admin-theme";

const AdminThemeContext = createContext<AdminTheme | null>(null);

export function AdminThemeProvider({ theme, children }: { theme: AdminTheme | null; children: ReactNode }) {
  return <AdminThemeContext.Provider value={theme}>{children}</AdminThemeContext.Provider>;
}

export function ThemeToggle() {
  const theme = useContext(AdminThemeContext);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function toggle() {
    const current = theme ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setError(false);
    startTransition(async () => {
      try {
        await setAdminTheme(current === "dark" ? "light" : "dark");
      } catch {
        setError(true);
      }
    });
  }

  return (
    <>
      {(["dark", "light"] as const).map((mode) => (
        <button key={mode} type="button" disabled={pending} onClick={toggle}
          aria-label={mode === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className={`admin-theme-when-${mode} rounded-md border border-admin-line px-2.5 py-1.5 text-admin-text disabled:opacity-50`}>
          {mode === "dark" ? "Modo oscuro" : "Modo claro"}
        </button>
      ))}
      {error && <span role="alert">No se pudo cambiar el tema. Intentá de nuevo.</span>}
    </>
  );
}
