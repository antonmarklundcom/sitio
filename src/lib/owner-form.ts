import { z } from "zod";

/**
 * Whitelistan för /mi-sitio. Fälten som INTE står här kan inte ändras av en
 * owner — inte heller med ett handskrivet formulär, eftersom serveråtgärden
 * bara läser de fält som finns i schemat.
 *
 * Utanför: slug, themeKey, paletteVariant, status, category, seoTitle,
 * seoDescription, whatsappPhone (byte kräver ny verifiering), rawDescription.
 */
const trimmed = (max: number) => z.string().trim().max(max);

export const ownerFormSchema = z.object({
  name: trimmed(120).min(2, "Escribí el nombre de tu negocio."),
  description: trimmed(2000).min(80, "La descripción necesita al menos 80 caracteres."),
  address: trimmed(200).optional().or(z.literal("")),
  zone: trimmed(80).optional().or(z.literal("")),
  city: trimmed(80).min(2, "¿En qué ciudad estás?"),
  secondaryPhone: trimmed(20).optional().or(z.literal("")),
  mapsUrl: trimmed(300).optional().or(z.literal("")),
  instagram: trimmed(300).optional().or(z.literal("")),
  facebook: trimmed(300).optional().or(z.literal("")),
  tiktok: trimmed(300).optional().or(z.literal("")),
});

export type OwnerFormValues = z.infer<typeof ownerFormSchema>;

/** Upp till åtta tjänster i owner-vyn — fler än så blir en lista ingen läser. */
export const OWNER_MAX_SERVICES = 8;

export function ownerServicesFromForm(formData: FormData): { name: string; desc?: string }[] {
  const out: { name: string; desc?: string }[] = [];
  for (let i = 0; i < OWNER_MAX_SERVICES; i++) {
    const name = String(formData.get(`service.${i}.name`) ?? "").trim();
    if (!name) continue;
    const desc = String(formData.get(`service.${i}.desc`) ?? "").trim();
    out.push(desc ? { name: name.slice(0, 120), desc: desc.slice(0, 300) } : { name: name.slice(0, 120) });
  }
  return out;
}

/**
 * Öppettider: två pass per dag, för siestan är regel i Paraguay och owner-vyn
 * fylls i i lugn och ro — till skillnad från intaken, som körs på telefon
 * medan säljsamtalet pågår.
 */
export function ownerHoursFromForm(
  formData: FormData,
): Record<string, { open: string; close: string }[] | null> {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const time = /^\d{2}:\d{2}$/;
  const out: Record<string, { open: string; close: string }[] | null> = {};

  for (const day of days) {
    if (formData.get(`hours.${day}.closed`) === "on") {
      out[day] = null;
      continue;
    }
    const intervals: { open: string; close: string }[] = [];
    for (const slot of [0, 1]) {
      const open = String(formData.get(`hours.${day}.${slot}.open`) ?? "").trim();
      const close = String(formData.get(`hours.${day}.${slot}.close`) ?? "").trim();
      if (time.test(open) && time.test(close) && close > open) intervals.push({ open, close });
    }
    out[day] = intervals.length > 0 ? intervals : null;
  }
  return out;
}
