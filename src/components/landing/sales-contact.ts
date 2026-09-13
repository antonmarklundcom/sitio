import { displayPhone, normalizePyPhone, waLink } from "@/lib/format";

/** Meddelandet som ligger förifyllt i WhatsApp när någon klickar på CTA:n. */
export const SALES_MESSAGE =
  "Hola, vi sitio.com.py y quiero una página para mi negocio.";

export type SalesContact = {
  /** wa.me-länk, eller `#contacto` när numret saknas/inte går att tolka. */
  href: string;
  /** E.164 (+595…), eller null när numret saknas. */
  e164: string | null;
  /** Numret i visningsform, eller null. */
  display: string | null;
};

/**
 * Ett enda CTA-mål på hela sidan (plan.md §1.4). Saknas
 * NEXT_PUBLIC_SALES_WHATSAPP faller länken tillbaka på ankaret `#contacto`
 * i stället för att rendera en trasig wa.me-URL — sidan byggs alltid.
 *
 * Ligger i en JSX-fri fil så att enhetstestet kan importera den utan att
 * dra in en .tsx genom vitests esbuild-steg (tsconfig kör jsx: preserve).
 */
export function salesContact(raw: string): SalesContact {
  const e164 = raw ? normalizePyPhone(raw) : null;
  if (!e164) return { href: "#contacto", e164: null, display: null };
  return { href: waLink(e164, SALES_MESSAGE), e164, display: displayPhone(e164) };
}
