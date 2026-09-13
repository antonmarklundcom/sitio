import { waLink } from "@/lib/format";
import { LEAD_STAGES, LEAD_STAGE_LABELS, leadPitchMessage, type LeadStage } from "@/lib/radar";
import type { LeadRow } from "@/db/lead-queries";
import { saveLeadNoteAction, setLeadStageAction } from "@/app/admin/(dashboard)/leads/actions";

function stageTone(stage: LeadStage): "neutral" | "warn" | "ok" {
  if (stage === "vendido") return "ok";
  if (stage === "ninguno") return "neutral";
  return "warn";
}

/** En rad i `/admin/leads`. Server-renderad — stadieknappar och notisfältet är egna formulär mot serveråtgärder, ingen klient-JS behövs. */
export function LeadsRow({ lead }: { lead: LeadRow }) {
  const pitchHref = waLink(
    lead.whatsappPhone,
    leadPitchMessage({ businessName: lead.name, views30d: lead.views30d, waClicks30d: lead.waClicks30d }),
  );

  return (
    <tr className="border-b border-admin-line last:border-0 align-top">
      <td className="px-3 py-3">
        <a href={`/admin/sitios/${lead.id}`} className="font-medium hover:text-admin-accent">
          {lead.name}
        </a>
        <span className="block font-mono text-xs text-admin-muted">/{lead.slug}</span>
      </td>
      <td className="px-3 py-3 text-right">
        <span className="font-mono">{lead.upsellScore}</span>
        {lead.hotLead ? <span className="ml-1.5 text-admin-danger" title="Hot lead">●</span> : null}
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums">{lead.views30d}</td>
      <td className="px-3 py-3 text-right font-mono tabular-nums">{lead.waClicks30d}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {LEAD_STAGES.map((stage) => (
            <form key={stage} action={setLeadStageAction}>
              <input type="hidden" name="businessId" value={lead.id} />
              <input type="hidden" name="stage" value={stage} />
              <button
                type="submit"
                disabled={lead.leadStage === stage}
                className={`rounded-full border px-2 py-0.5 text-xs transition disabled:cursor-default ${
                  lead.leadStage === stage
                    ? stageTone(stage) === "ok"
                      ? "border-admin-ok/40 bg-admin-ok/10 text-admin-ok"
                      : stageTone(stage) === "warn"
                        ? "border-admin-warn/40 bg-admin-warn/10 text-admin-warn"
                        : "border-admin-line bg-admin-surface-2 text-admin-muted"
                    : "border-admin-line text-admin-muted hover:border-admin-muted hover:text-admin-text"
                }`}
              >
                {LEAD_STAGE_LABELS[stage]}
              </button>
            </form>
          ))}
        </div>
      </td>
      <td className="px-3 py-3">
        <form action={saveLeadNoteAction} className="flex items-start gap-2">
          <input type="hidden" name="businessId" value={lead.id} />
          <textarea
            name="adminNotes"
            defaultValue={lead.adminNotes ?? ""}
            rows={2}
            placeholder="Anteckning…"
            className="w-56 rounded-md border border-admin-line bg-admin-surface px-2 py-1 text-xs outline-none focus:border-admin-accent"
          />
          <button
            type="submit"
            className="rounded-md border border-admin-line bg-admin-surface-2 px-2 py-1 text-xs hover:border-admin-muted"
          >
            Spara
          </button>
        </form>
      </td>
      <td className="px-3 py-3 text-right">
        <a href={pitchHref} target="_blank" rel="noreferrer" className="text-admin-accent hover:underline">
          WhatsApp →
        </a>
      </td>
    </tr>
  );
}
