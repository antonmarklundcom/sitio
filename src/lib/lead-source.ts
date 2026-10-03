/**
 * Varifrån en besökare kom (crm-1). Klientsäker och ren: delas av
 * /api/consulta (sparar `site_leads.source`), ref-uppslaget i ägarens CRM och
 * Fuentes-vyn. `utm_source` vinner över referrern — en länk i en
 * Instagram-bio taggad `?utm_source=instagram` säger mer än en tom referrer
 * från Instagrams app-webbläsare.
 */

export const LEAD_SOURCES = ["google", "instagram", "facebook", "tiktok", "whatsapp", "directo", "otro"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  google: "Google",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  directo: "Directo",
  otro: "Otro sitio",
};

const HOST_RULES: [RegExp, LeadSource][] = [
  [/(^|\.)google\.(com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/, "google"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
];

function fromName(name: string): LeadSource | null {
  const n = name.toLowerCase().trim();
  if (!n) return null;
  if (n === "ig" || n.includes("instagram")) return "instagram";
  if (n === "fb" || n.includes("facebook") || n.includes("meta")) return "facebook";
  if (n.includes("google") || n === "gbp" || n === "maps") return "google";
  if (n.includes("tiktok")) return "tiktok";
  if (n === "wa" || n.includes("whatsapp")) return "whatsapp";
  return "otro";
}

/** `referrer` är en full URL eller ett värdnamn; `utmSource` är ?utm_source. */
export function classifyLeadSource(referrer: string | null | undefined, utmSource?: string | null): LeadSource {
  const byUtm = utmSource ? fromName(utmSource) : null;
  if (byUtm) return byUtm;
  if (!referrer) return "directo";
  let host = referrer.toLowerCase().trim();
  try {
    if (host.includes("/")) host = new URL(host).hostname;
  } catch {
    return "directo";
  }
  if (!host) return "directo";
  for (const [re, source] of HOST_RULES) if (re.test(host)) return source;
  return "otro";
}

export function leadSourceLabel(source: string | null | undefined): string {
  return source && source in LEAD_SOURCE_LABELS ? LEAD_SOURCE_LABELS[source as LeadSource] : "—";
}
