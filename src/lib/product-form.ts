import { z } from "zod";

/**
 * Produktlistans whitelist. Samma princip som menu-form.ts: en owner får röra
 * namn, beskrivning, pris och synlighet — inget annat. businessId kommer
 * alltid ur sessionen, aldrig ur formuläret.
 *
 * Produkter har ingen sektionsnivå (skillnaden mot menyn) — en enda lista,
 * och taket finns för att en katalog på en telefon som rullar i evighet
 * aldrig blir klar.
 */
export const PRODUCTS_MAX = 60;

/** Guaraníes är heltal utan decimaler. Tomt fält = "A consultar". */
const priceField = z
  .string()
  .trim()
  .transform((raw) => raw.replace(/[^\d]/g, ""))
  .refine((digits) => digits.length <= 12, { message: "Ese precio es demasiado grande." })
  .transform((digits) => (digits === "" ? null : Number(digits)))
  .refine((n) => n === null || (Number.isSafeInteger(n) && n >= 0 && n <= 999_999_999), {
    message: "Poné un precio en guaraníes, sin puntos ni decimales.",
  });

export const productSchema = z.object({
  name: z.string().trim().min(2, "¿Cómo se llama el producto?").max(120),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  priceGs: priceField,
  isVisible: z.boolean(),
});

export type ProductValues = z.infer<typeof productSchema>;

/** Läser ett produktformulär. Checkboxar saknas i posten när de är avbockade. */
export function productFromForm(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    priceGs: String(formData.get("priceGs") ?? ""),
    isVisible: formData.get("isVisible") === "on" || formData.get("isVisible") === "1",
  });
}
