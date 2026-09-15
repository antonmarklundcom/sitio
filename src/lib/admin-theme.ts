export const ADMIN_THEME_COOKIE = "admin-theme";
export const ADMIN_THEMES = ["light", "dark"] as const;
export type AdminTheme = (typeof ADMIN_THEMES)[number];

export function parseAdminTheme(value: string | undefined): AdminTheme | null {
  return value === "light" || value === "dark" ? value : null;
}
