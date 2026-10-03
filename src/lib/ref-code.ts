/**
 * Ref-kod på WhatsApp-klick: en kort kod ("K7Q2") läggs i meddelandetexten och
 * sparas i `analytics_events.ref_code`, så att ägaren kan koppla en
 * WhatsApp-konversation tillbaka till klicket. Klientsäker och ren — alfabetet
 * delas av beaconen (inline-script), /api/ev och ägarens uppslag.
 *
 * Alfabetet saknar I, L, O, 0 och 1 — de förväxlas när någon läser upp koden.
 */

export const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const REF_LENGTH = 4;

/** Samma regex som beaconen genererar mot. */
export const REF_CODE_RE = new RegExp(`^[${REF_ALPHABET}]{${REF_LENGTH}}$`);

export function isRefCode(v: unknown): v is string {
  return typeof v === "string" && REF_CODE_RE.test(v);
}

/**
 * Städar en kod som en människa skrivit eller klistrat in: "ref k7q2",
 * "(ref K7Q2)", " k7 q2 ". Returnerar null om resultatet inte är en giltig kod.
 */
export function normalizeRefCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw
    .trim()
    .toUpperCase()
    .replace(/^\(?\s*REF\b[\s:.-]*/, "")
    .replace(/^REF(?=[A-Z0-9]{4}\b)/, "")
    .replace(/[\s()]/g, "");
  return isRefCode(s) ? s : null;
}
