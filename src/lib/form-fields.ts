import { z } from "zod";
import { normalizePyPhone } from "./format";

/**
 * Valfria fält i kundens formulär (intake och ägarpanelen), spanska meddelanden
 * (R3-42). Samma regler som adminets schema i `business.ts`: ett andra nummer
 * sparas normaliserat (+595…) och länkar måste vara fullständiga URL:er —
 * annars blir `@mitienda` en trasig länk på sajten.
 */

/**
 * Tomt ⇒ "". Annars ett paraguayanskt nummer i E.164. Ett fält som saknas i
 * formuläret (undefined) är samma sak som tomt.
 */
export const optionalPyPhoneEs = z
  .string()
  .trim()
  .max(30, "Ese número es demasiado largo.")
  .transform((v, ctx) => {
    if (!v) return "";
    const normalized = normalizePyPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Ese número no parece paraguayo. Ej: 021 234 567 o 0981 123 456" });
      return z.NEVER;
    }
    return normalized;
  })
  .default("");

/** Tomt ⇒ "". Annars en länk som börjar med http:// eller https://. */
export function optionalHttpUrlEs(example: string) {
  return z
    .string()
    .trim()
    .max(300, "Ese enlace es demasiado largo.")
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), `Pegá el enlace completo, por ejemplo ${example}`)
    .default("");
}
