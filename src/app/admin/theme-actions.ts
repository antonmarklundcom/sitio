"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ADMIN_THEME_COOKIE, parseAdminTheme, type AdminTheme } from "@/lib/admin-theme";

export async function setAdminTheme(value: AdminTheme): Promise<void> {
  const theme = parseAdminTheme(value);
  if (!theme) throw new Error("Tema no válido.");

  (await cookies()).set(ADMIN_THEME_COOKIE, theme, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/admin", "layout");
}
