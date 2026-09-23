"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createDraftBusinessWithToken, registroSchema, RegistrationUnavailableError } from "@/lib/intake-create";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";

export type RegistroState = { error?: string; ok?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

export async function registerAction(_prev: RegistroState, formData: FormData): Promise<RegistroState> {
  const h = await headers();
  const ip = clientIpFrom(h);
  if (!rateLimit(`registro:${ip}`, 5, 60 * 60 * 1000).ok) {
    return { error: "Hiciste demasiados intentos. Probá de nuevo en una hora." };
  }
  if (String(formData.get("website") ?? "") !== "") return { ok: "¡Gracias! Recibimos tu solicitud." };
  const values = Object.fromEntries(["name", "category", "phone", "city", "website"].map(key => [key, String(formData.get(key) ?? "")]));
  const result = registroSchema.safeParse(values);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors, values };
  }
  let token: string;
  try {
    ({ token } = await createDraftBusinessWithToken({ ...result.data, source: "registro", actorUserId: null }));
  } catch (error) {
    if (error instanceof RegistrationUnavailableError) return { error: error.message, values };
    return { error: "No pudimos crear tu página. Probá de nuevo en unos minutos.", values };
  }
  revalidatePath("/admin/alta");
  revalidatePath("/admin");
  redirect(`/alta/${token}`);
}
