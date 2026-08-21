import { z } from "zod";

/**
 * Menyns whitelist. Samma princip som owner-form.ts: en owner får röra namn,
 * beskrivning, pris och tillgänglighet — inget annat. businessId finns inte
 * som fält någonstans; det kommer alltid ur sessionen.
 *
 * Taken är inte godtyckliga. En meny på en telefon läses uppifrån och ner utan
 * navigering: fler än tolv sektioner är ingen meny längre, och fyrtio rätter i
 * en sektion hittar ingen igenom.
 */
export const MENU_MAX_SECTIONS = 12;
export const MENU_MAX_ITEMS_PER_SECTION = 40;

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

export const menuSectionSchema = z.object({
  name: z.string().trim().min(2, "Poné un nombre a la sección.").max(80),
});

export const menuItemSchema = z.object({
  name: z.string().trim().min(2, "¿Cómo se llama el plato?").max(120),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  priceGs: priceField,
  isAvailable: z.boolean(),
});

export type MenuItemValues = z.infer<typeof menuItemSchema>;

/** Läser ett rättformulär. Checkboxar saknas i posten när de är avbockade. */
export function menuItemFromForm(formData: FormData) {
  return menuItemSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    priceGs: String(formData.get("priceGs") ?? ""),
    isAvailable: formData.get("isAvailable") === "on" || formData.get("isAvailable") === "1",
  });
}
