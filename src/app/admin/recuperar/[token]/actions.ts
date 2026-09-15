"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { findActiveSuperadminByEmail, logActivity } from "@/lib/auth";
import { validatePassword, verifyResetToken } from "@/lib/password-reset";

export async function resetAction(token: string, formData: FormData): Promise<void> {
  const claims = verifyResetToken(token, Date.now());
  if (!claims) redirect("/admin/recuperar?invalido=1");
  const user = await findActiveSuperadminByEmail(claims.email);
  if (!user || user.id !== claims.userId || user.email !== claims.email) redirect("/admin/recuperar?invalido=1");
  const password = formData.get("password");
  const error = validatePassword(password);
  if (error || password !== formData.get("repeat")) {
    redirect("/admin/recuperar/" + encodeURIComponent(token) + "?error=" + (error ? "password" : "repeat"));
  }
  const passwordHash = await bcrypt.hash(password as string, 10);
  // Recheck expiry after bcrypt work.
  if (!verifyResetToken(token, Date.now())) redirect("/admin/recuperar?invalido=1");
  await db.update(users).set({ passwordHash }).where(and(
    eq(users.id, user.id), eq(users.email, claims.email), eq(users.role, "superadmin"), eq(users.status, "active"),
  ));
  await logActivity({ actorUserId: user.id, action: "contrasena_restablecida" });
  redirect("/admin/login?restablecida=1");
}

