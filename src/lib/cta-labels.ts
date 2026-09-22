/**
 * `data-ev-loc` → vad knappen heter på sidan, på spanska (R3-18, R3-23).
 * Klientsäker: delas av adminets statistikpanel och kundens årsrapport.
 * Okända värden visas rakt av.
 */
export const CTA_LOC_LABELS: Record<string, string> = {
  hero: "portada",
  header: "encabezado",
  dock: "barra fija",
  contacto: "contacto",
  donde: "dónde estamos",
  footer: "pie de página",
  servicios: "servicios",
  productos: "productos",
  especialidades: "especialidades",
  pagina: "página adicional",
};

export function ctaLabel(loc: string): string {
  return CTA_LOC_LABELS[loc] ?? loc;
}
