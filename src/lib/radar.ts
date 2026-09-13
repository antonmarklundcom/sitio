/**
 * Upsell-radar (plan.md §6.3). Poängen räknas nattligen i cron-routen, aldrig
 * vid läsning — samma "aldrig från råeventen"-regel som analytics-listan:
 * trafiksiffrorna kommer alltid ur `analytics_daily`.
 *
 * Ren funktion, ingen DB-import: `runRadar()` i `src/db/lead-queries.ts` samlar
 * in `UpsellStats` per sajt och skriver resultatet.
 */

export type UpsellStats = {
  waClicks30d: number;
  views30d: number;
  hasGalleryPhotos: boolean; // ≥ 8 foton
  hasMenuOrProducts: boolean; // modulen `menu` eller `products` påslagen
  subscriptionActiveLongRemaining: boolean; // status active och > 200 dagar kvar
};

export type HotLeadThresholds = {
  waClicks30d: number;
  views30d: number;
};

/**
 * Score = min(100, round(0.5×waClicks30d + 0.05×views30d + 10×galleri + 10×
 * meny/produkter + 15×betald med god marginal)). Vikterna är plan §6.3,
 * skrivna literalt så en drift blir ett misslyckat test, inte en överraskning.
 */
export function computeUpsellScore(stats: UpsellStats): number {
  const raw =
    0.5 * stats.waClicks30d +
    0.05 * stats.views30d +
    (stats.hasGalleryPhotos ? 10 : 0) +
    (stats.hasMenuOrProducts ? 10 : 0) +
    (stats.subscriptionActiveLongRemaining ? 15 : 0);
  return Math.min(100, Math.round(raw));
}

/** En "hot lead" är en sajt som redan visar köpsignaler — oavsett poäng. */
export function isHotLead(
  stats: Pick<UpsellStats, "waClicks30d" | "views30d">,
  thresholds: HotLeadThresholds,
): boolean {
  return stats.waClicks30d >= thresholds.waClicks30d || stats.views30d >= thresholds.views30d;
}

/**
 * Säljstadierna i `/admin/leads` (schema: `businesses.leadStage`). Fri
 * riktning — en superadmin kan flytta en rad bakåt lika lätt som framåt, ett
 * felklick ska inte kräva en databasändring för att rättas.
 */
export const LEAD_STAGES = ["ninguno", "contactado", "cotizado", "vendido"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  ninguno: "Inget",
  contactado: "Kontaktad",
  cotizado: "Offererad",
  vendido: "Såld",
};

/**
 * wa.me-pitchen i `/admin/leads`, samma ärlighetsregel som `renewalMessage`
 * (`src/lib/billing.ts`): siffrorna säljer, och utelämnas hellre än gissas
 * eller avrundas till något som låter bättre än det är.
 */
export function leadPitchMessage(params: {
  businessName: string;
  views30d: number;
  waClicks30d: number;
}): string {
  const { businessName, views30d, waClicks30d } = params;
  const nf = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });

  const stats =
    views30d > 0 || waClicks30d > 0
      ? `Tu página tuvo ${nf.format(views30d)} visitas y ${nf.format(waClicks30d)} contactos por WhatsApp en los últimos 30 días 📈. `
      : "";

  return `Hola ${businessName}! Te escribo de sitio.com.py. ${stats}¿Charlamos sobre potenciar tu página?`;
}
