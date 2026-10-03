"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { establishSession, findActiveSuperadminByEmail, logActivity } from "@/lib/auth";
import { pruneRateLimits, rateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { passwordVersion } from "@/lib/password-reset";

// En riktig bcrypt-hash (kostnad 10) för ett lösenord ingen har: jämförelsen
// mot den tar lika lång tid som mot en riktig användare. Den gamla
// platshållaren var 65 tecken, ogiltig, och bcrypt svarade direkt — svarstiden
// avslöjade vilka adresser som är superadmin.
const DUMMY_HASH = bcrypt.hashSync("sitio-dummy-" + Math.random().toString(36), 10);
import { clientIpFrom } from "@/lib/client-ip";
import { safeNext } from "@/lib/safe-next";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }

  const { email, password } = parsed.data;

  pruneRateLimits();
  const hdrs = await headers();
  const ip = clientIpFrom(hdrs);
  // Per e-post räknas bara MISSLYCKADE försök, och det strama taket gäller
  // e-post + IP. Annars kunde vem som helst som känner din adress hålla dig
  // utelåst med fem försök var femtonde minut. Det globala e-posttaket
  // (30 misslyckade/15 min) stoppar fortfarande en distribuerad gissning.
  const limited =
    !rateLimit(`login:ip:${ip}`, 10, 15 * 60_000).ok ||
    !rateLimit(`login:email-ip:${email}:${ip}`, 5, 15 * 60_000).ok ||
    rateLimitExceeded(`login:email-fail:${email}`, 30);

  if (limited) {
    return { error: "Demasiados intentos. Esperá 15 minutos y probá de nuevo." };
  }

  const user = await findActiveSuperadminByEmail(email);

  // Kör alltid en hash-jämförelse, även när användaren saknas: annars avslöjar
  // svarstiden vilka e-postadresser som finns.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) {
    rateLimit(`login:email-fail:${email}`, 30, 15 * 60_000);
    await logActivity({ action: "login_failed", meta: { email, ip } });
    return { error: "Correo o contraseña incorrectos." };
  }

  await establishSession({ userId: user.id, role: "superadmin", name: user.name, pv: passwordVersion(user.passwordHash) });
  await logActivity({ actorUserId: user.id, action: "login", meta: { ip } });

  // Tillbaka dit middleware skickade från (R3-42) — bara en relativ /admin-sökväg.
  redirect(safeNext(formData.get("next"), "admin", "/admin"));
}

export async function logoutAction(): Promise<void> {
  const { destroySession } = await import("@/lib/auth");
  const { currentUser } = await import("@/lib/session");
  const user = await currentUser();
  if (user?.userId) await logActivity({ actorUserId: user.userId, action: "logout" });
  await destroySession();
  redirect("/admin/login");
}
