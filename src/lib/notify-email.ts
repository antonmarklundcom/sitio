import "server-only";
import { emailConfigured, sendEmail } from "./email";
import { absoluteUrl } from "./env";
import type { NewLeadNotice } from "./lead-notify";

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Namn som hamnar i ämnesrad och From: inga radbrytningar, rimlig längd. */
function clean(s: string, max: number): string {
  return s.replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function dayEs(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : day;
}

/** Ren funktion: ämne, text och html för ett nytt lead. Allt användarinnehåll escapas i html. */
export function buildLeadEmail(lead: NewLeadNotice, businessName: string) {
  const name = clean(lead.name, 80) || "un visitante";
  const turno = lead.kind === "turno";
  const subject = turno ? `Nuevo pedido de turno de ${name}` : `Nueva consulta de ${name} en tu página`;
  const link = absoluteUrl("/mi-sitio/clientes");

  const rows: [string, string][] = [["Nombre", name]];
  if (lead.serviceName) rows.push(["Servicio", clean(lead.serviceName, 200)]);
  if (lead.requestedDay) rows.push(["Día", dayEs(lead.requestedDay)]);
  if (lead.requestedTime) rows.push(["Hora", clean(lead.requestedTime, 20)]);
  if (lead.message) rows.push(["Mensaje", lead.message.trim().slice(0, 2000)]);

  const intro = turno ? "Recibiste un nuevo pedido de turno en tu página." : "Recibiste una nueva consulta en tu página.";
  const text = [intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", `Verla y responder: ${link}`].join("\n");

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">${escapeHtml(k)}</td>` +
        `<td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:520px">` +
    `<p style="margin:0 0 12px">${escapeHtml(intro)}</p>` +
    `<table style="border-collapse:collapse;margin:0 0 16px">${rowsHtml}</table>` +
    `<p style="margin:0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#111827;color:#ffffff;` +
    `text-decoration:none;padding:10px 18px;border-radius:6px">Ver en mi panel</a></p>` +
    `<p style="margin:16px 0 0;color:#6b7280;font-size:12px">${escapeHtml(clean(businessName, 80))} · sitio.com.py</p>` +
    `</div>`;
  return { subject, text, html };
}

/** Mejl till ägaren när det kommer ett nytt lead. Kastar aldrig; tyst när mejl inte är konfigurerat. */
export async function sendLeadEmail(to: string, lead: NewLeadNotice, businessName: string): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const address = to.trim();
    if (!EMAIL_RE.test(address) || address.length > 254) return;
    const { subject, text, html } = buildLeadEmail(lead, businessName);
    const fromName = `${clean(businessName, 60) || "Tu negocio"} vía sitio.com.py`;
    await sendEmail({ to: address, subject, text, html, fromName });
  } catch {
    // Körs efter HTTP-svaret; consultan är redan sparad. Logga aldrig leverantörssvar.
  }
}
