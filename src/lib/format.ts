/** Formatering för PY: guaraníes utan decimaler, telefonnummer i E.164. */

export function formatGs(amount: number | null | undefined): string {
  if (amount == null) return "A consultar";
  return `₲ ${new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(amount)}`;
}

/**
 * Normaliserar ett paraguayanskt nummer till E.164 (+595XXXXXXXXX).
 * Accepterar "0981 123 456", "981123456", "+595981123456", "595981123456".
 * Returnerar null om det inte går att tolka som ett giltigt PY-nummer.
 */
export function normalizePyPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  let national: string;

  if (digits.startsWith("595")) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;

  national = national.replace(/^0+/, "");

  // Mobil: 9XX XXXXXX (9 siffror). Fast: 21..., 61... (8–9 siffror).
  if (!/^\d{8,9}$/.test(national)) return null;
  return `+595${national}`;
}

/** Visningsformat: +595 981 123 456 */
export function displayPhone(e164: string): string {
  const m = /^\+595(\d{3})(\d{3})(\d{3})$/.exec(e164);
  if (m) return `+595 ${m[1]} ${m[2]} ${m[3]}`;
  const m8 = /^\+595(\d{2})(\d{3})(\d{3})$/.exec(e164);
  if (m8) return `+595 ${m8[1]} ${m8[2]} ${m8[3]}`;
  return e164;
}

/** wa.me-länk med förifyllt meddelande. */
export function waLink(e164Phone: string, message?: string): string {
  const num = e164Phone.replace(/[^\d]/g, "");
  const q = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${num}${q}`;
}
