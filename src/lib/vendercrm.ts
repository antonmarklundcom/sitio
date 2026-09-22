import "server-only";
import { createHash } from "node:crypto";
import { env } from "./env";

/**
 * VenderCRM-push för hot leads (R3-22, PR-22). Mönstret från skillen
 * vendercrm-lead-capture: nyckeln finns bara på servern, varje lead har en
 * stabil idempotency_key, och CRM:et får aldrig blockera något — ett fel
 * loggas, det kastas inte. Pipeline, steg och ägare skickas aldrig: routingen
 * bor på site-posten i CRM:et.
 *
 * Här är "leaden" en av våra egna kunder vars sajt blivit hot (radarn,
 * plan §6.3): en säljare ska ringa om uppgradering. Utan VENDERCRM_URL och
 * VENDERCRM_API_KEY är allt en no-op.
 */

export type VenderCrmConfig = { url: string; apiKey: string };

export type LeadPayload = {
  phone: string;
  idempotency_key: string;
  name?: string;
  message?: string;
  source?: string;
  page_url?: string;
  fields?: Record<string, string | number | boolean | null>;
};

export type HotLeadInput = {
  businessId: number;
  name: string;
  slug: string;
  category: string;
  whatsappPhone: string;
  waClicks30d: number;
  views30d: number;
  upsellScore: number;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
};

/** Konfigurationen, eller null när push är avstängd (ingen nyckel/URL). */
export function venderCrmConfig(
  rawUrl: string = env.venderCrmUrl,
  rawKey: string = env.venderCrmApiKey,
): VenderCrmConfig | null {
  const url = rawUrl.trim().replace(/\/+$/, "");
  const apiKey = rawKey.trim();
  return url && apiKey ? { url, apiKey } : null;
}

/**
 * En push per sajt och dygn, oavsett hur många gånger cron körs: nyckeln är
 * sajten + dygnet. Blir sajten hot igen en annan dag är det en ny lead.
 */
export function hotLeadIdempotencyKey(businessId: number, dayKey: string): string {
  return createHash("sha256").update(`sitio-hot-lead|${businessId}|${dayKey}`).digest("hex").slice(0, 40);
}

/** Payloaden för en hot lead. Ren funktion — testad utan nätverk. */
export function hotLeadPayload(lead: HotLeadInput, pageUrl: string, dayKey: string): LeadPayload {
  const plan = lead.subscriptionStatus
    ? ` Plan ${lead.subscriptionStatus}${lead.subscriptionExpiresAt ? `, vence ${lead.subscriptionExpiresAt}` : ""}.`
    : "";
  return {
    phone: lead.whatsappPhone,
    idempotency_key: hotLeadIdempotencyKey(lead.businessId, dayKey),
    name: lead.name.slice(0, 200),
    message:
      `Hot lead de sitio.com.py: ${lead.waClicks30d} clics en WhatsApp y ${lead.views30d} visitas en 30 días ` +
      `(puntaje ${lead.upsellScore}).${plan} Candidato a upgrade.`,
    source: "sitio:hot-lead",
    page_url: pageUrl,
    fields: {
      business_id: lead.businessId,
      slug: lead.slug,
      rubro: lead.category,
      wa_clicks_30d: lead.waClicks30d,
      visitas_30d: lead.views30d,
      upsell_score: lead.upsellScore,
    },
  };
}

export type PushResult = { ok: boolean; status: number | null; duplicate?: boolean; error?: string };

/**
 * POST /api/v1/leads. 201 och 200 (replay av samma nyckel) är båda framgång.
 * Tio sekunders timeout; nätverksfel blir `{ ok: false }`, aldrig ett kast.
 */
export async function pushLead(
  config: VenderCrmConfig,
  payload: LeadPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  try {
    const res = await fetchImpl(`${config.url}/api/v1/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 200 || res.status === 201) {
      const body = (await res.json().catch(() => ({}))) as { duplicate?: boolean };
      return { ok: true, status: res.status, duplicate: Boolean(body.duplicate) };
    }
    // 401 nyckel, 403 site avstängd, 422 fältet står i svaret, 429 takt.
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text.slice(0, 300) };
  } catch (err) {
    return { ok: false, status: null, error: err instanceof Error ? err.message : String(err) };
  }
}
