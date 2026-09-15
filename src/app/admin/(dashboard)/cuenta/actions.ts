"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { logActivity, requireRole } from "@/lib/auth";
import { validatePassword } from "@/lib/password-reset";

export async function changePasswordAction(formData: FormData): Promise<void> {
  const session = await requireRole("superadmin");
  const [user] = await db.select().from(users).where(and(
    eq(users.id, session.userId), eq(users.role, "superadmin"), eq(users.status, "active"),
  )).limit(1);
  const current = formData.get("current");
  if (!user?.passwordHash || typeof current !== "string" || !await bcrypt.compare(current, user.passwordHash)) {
    redirect("/admin/cuenta?error=current");
  }
  const password = formData.get("password");
  if (validatePassword(password)) redirect("/admin/cuenta?error=password");
  if (password !== formData.get("repeat")) redirect("/admin/cuenta?error=repeat");
  const passwordHash = await bcrypt.hash(password as string, 10);
  const [result] = await db.update(users).set({ passwordHash }).where(and(
    eq(users.id, user.id), eq(users.passwordHash, user.passwordHash),
    eq(users.role, "superadmin"), eq(users.status, "active"),
  ));
  if (!result.affectedRows) redirect("/admin/cuenta?error=current");
  await logActivity({ actorUserId: user.id, action: "contrasena_cambiada" });
  redirect("/admin/cuenta?guardada=1");
}

