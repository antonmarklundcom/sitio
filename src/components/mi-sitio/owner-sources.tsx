import { getSourceBreakdown } from "@/db/analytics-queries";
import { LEAD_SOURCE_LABELS } from "@/lib/lead-source";

/**
 * "¿De dónde vienen tus clientes?" (crm-1). Server-komponent, ingen klient-JS.
 * Visar de senaste 30 dygnen per källa: visitas, clics a WhatsApp, consultas.
 */
export async function OwnerSources({ businessId }: { businessId: number }) {
  const rows = await getSourceBreakdown(businessId, 30);
  const nf = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });

  return (
    <div className="panel-card">
      <h2>¿De dónde vienen tus clientes?</h2>
      {rows.length === 0 ? (
        <p>Todavía no hay datos. Cuando empiecen las visitas, vas a ver acá de dónde llegan.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <caption className="panel-note" style={{ textAlign: "left", padding: 0, margin: "0 0 0.5rem" }}>
            Últimos 30 días
          </caption>
          <thead>
            <tr style={{ textAlign: "right", color: "var(--muted)" }}>
              <th scope="col" style={{ textAlign: "left", fontWeight: 500 }}>Origen</th>
              <th scope="col" style={{ fontWeight: 500 }}>Visitas</th>
              <th scope="col" style={{ fontWeight: 500 }}>Clics a WhatsApp</th>
              <th scope="col" style={{ fontWeight: 500 }}>Consultas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source} style={{ textAlign: "right", borderTop: "1px solid var(--line)" }}>
                <th scope="row" style={{ textAlign: "left", fontWeight: 600, padding: "0.4rem 0" }}>
                  {LEAD_SOURCE_LABELS[r.source]}
                </th>
                <td>{nf.format(r.views)}</td>
                <td>{nf.format(r.waClicks)}</td>
                <td>{nf.format(r.leads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint" style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.75rem" }}>
        Tip: en el link de tu bio de Instagram agregá <code>?utm_source=instagram</code> al final (por ejemplo
        tusitio.com.py/?utm_source=instagram) y vas a ver cuántos clientes llegan desde ahí.
      </p>
    </div>
  );
}
