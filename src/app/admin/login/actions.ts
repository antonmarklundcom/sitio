"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { establishSession, findActiveSuperadminByEmail, logActivity } from "@/lib/auth";
import { pruneRateLimits, rateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ogiltig e-postadress."),
  password: z.string().min(1, "Lösenord krävs."),
});

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter." };
  }

  const { email, password } = parsed.data;

  pruneRateLimits();
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited =
    !rateLimit(`login:ip:${ip}`, 10, 15 * 60_000).ok ||
    !rateLimit(`login:email:${email}`, 5, 15 * 60_000).ok;

  if (limited) {
    return { error: "För många försök. Vänta 15 minuter och försök igen." };
  }

  const user = await findActiveSuperadminByEmail(email);

  // Kör alltid en hash-jämförelse, även när användaren saknas: annars avslöjar
  // svarstiden vilka e-postadresser som finns.
  const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) {
    await logActivity({ action: "login_failed", meta: { email, ip } });
    return { error: "Fel e-post eller lösenord." };
  }

  await establishSession({ userId: user.id, role: "superadmin", name: user.name });
  await logActivity({ actorUserId: user.id, action: "login", meta: { ip } });

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const { destroySession } = await import("@/lib/auth");
  const { currentUser } = await import("@/lib/session");
  const user = await currentUser();
  if (user?.userId) await logActivity({ actorUserId: user.userId, action: "logout" });
  await destroySession();
  redirect("/admin/login");
}
