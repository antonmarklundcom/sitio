"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { findActiveSuperadminByEmail } from "@/lib/auth";
import { absoluteUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { createResetToken } from "@/lib/password-reset";
import { pruneRateLimits, rateLimit } from "@/lib/rate-limit";

export async function recoverAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  pruneRateLimits();
  const ipAllowed = rateLimit(`reset:ip:${ip}`, 10, 15 * 60_000).ok;
  const emailAllowed = rateLimit(`reset:email:${email}`, 3, 15 * 60_000).ok;
  if (ipAllowed && emailAllowed && z.string().max(190).email().safeParse(email).success) {
    try {
      const user = await findActiveSuperadminByEmail(email);
      if (user?.email) {
        const link = absoluteUrl("/admin/recuperar/" + createResetToken(user.id, user.email, Date.now()));
        const escapedLink = link.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        await sendEmail({
          to: user.email,
          subject: "Restablecé tu contraseña",
          text: `Para restablecer tu contraseña, abrí este enlace: ${link}\nVence en 30 minutos. Si no lo pediste, ignorá este correo.`,
          html: `<p>Para restablecer tu contraseña, <a href="${escapedLink}">abrí este enlace</a>.</p><p>Vence en 30 minutos. Si no lo pediste, ignorá este correo.</p>`,
        });
      }
    } catch {
      console.error("[password-reset] No se pudo procesar la solicitud de recuperación.");
    }
  }
  redirect("/admin/recuperar?enviado=1");
}

