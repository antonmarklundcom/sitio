import { notFound } from "next/navigation";
import { getPartnerReport } from "@/db/growth-queries";
import { absoluteUrl } from "@/lib/env";
import { formatGs, waLink } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_ES: Record<string, string> = {
  draft: "Cargando datos",
  pending_review: "En revisión",
  published: "Publicada",
  paused: "En pausa",
  archived: "Archivada",
};

/**
 * Säljarens egen sida (growth-1): länken att dela, kunderna och provisionen.
 * Ingen inloggning — tokenen i länken är nyckeln, som "tu año en cifras".
 */
export default async function SocioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await getPartnerReport(token);
  if (!report) notFound();
  const { partner, clients, commissions } = report;
  const signup = absoluteUrl(`/registro?ref=${partner.code}`);
  const pending = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amountGs), 0);
  const paid = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amountGs), 0);
  const share = `Hola! Te armo la página de tu negocio en sitio.com.py: WhatsApp, horarios, mapa y fotos, lista para Google. Registrate acá: ${signup}`;

  return (
    <main className="panel-wrap" lang="es-PY">
      <span className="panel-brand">sitio.com.py</span>
      <h1>Hola, {partner.name}</h1>
      <p>Ganás el {partner.commissionPct}% de lo que paga cada cliente que se registra con tu enlace, durante su primer año.</p>

      <div className="panel-card">
        <h2>Tu enlace</h2>
        <p className="panel-copy"><code>{signup}</code></p>
        <div className="panel-actions">
          <a href={waLink("", share)} target="_blank" rel="noreferrer" className="panel-btn">Compartir por WhatsApp</a>
        </div>
      </div>

      <div className="panel-card">
        <h2>Tus comisiones</h2>
        <p>Por cobrar: <strong>{formatGs(pending)}</strong> · Cobrado: <strong>{formatGs(paid)}</strong></p>
        {commissions.length > 0 ? (
          <ul className="panel-leads">
            {commissions.map((c) => (
              <li key={c.id} className="panel-lead">
                <div className="panel-lead-head">
                  <strong>{c.businessName}</strong>
                  <span className="hint">{new Date(c.createdAt).toISOString().slice(0, 10)} · {c.status === "paid" ? "cobrada" : c.status === "void" ? "anulada" : "por cobrar"}</span>
                </div>
                <p>{formatGs(Number(c.amountGs))}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">La comisión aparece cuando confirmamos el pago de tu cliente.</p>
        )}
      </div>

      <div className="panel-card">
        <h2>Tus clientes ({clients.length})</h2>
        {clients.length === 0 ? (
          <p className="hint">Todavía nadie se registró con tu enlace.</p>
        ) : (
          <ul className="panel-leads">
            {clients.map((c) => (
              <li key={c.id} className="panel-lead">
                <div className="panel-lead-head">
                  <strong>{c.name}</strong>
                  <span className="hint">{STATUS_ES[c.status] ?? c.status} · desde {new Date(c.createdAt).toISOString().slice(0, 10)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
