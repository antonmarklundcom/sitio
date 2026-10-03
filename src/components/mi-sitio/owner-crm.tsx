import Link from "next/link";
import { displayPhone, formatGs, waLink } from "@/lib/format";
import { dayEs } from "@/lib/growth";
import { toDayString } from "@/lib/billing";
import { KIND_LABELS, TAB_LABELS, CRM_TABS, crmReplyMessage, dayOf, isFollowUpDue, statusLabel, type CrmTab } from "@/lib/crm";
import { leadSourceLabel } from "@/lib/lead-source";
import type { SiteLead } from "@/db/schema";
import { LeadEditForm } from "./owner-crm-forms";

/**
 * "Mis clientes" (crm-1): serverkomponenter med vanliga formulär mot
 * serveråtgärder; klientformulären ligger i owner-crm-forms.tsx.
 * Spanska (voseo) — kundens yta.
 */

function dateTimeEs(value: Date): string {
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function CrmStats({ stats }: { stats: { leads: number; clientes: number; valueGs: number } }) {
  return (
    <div className="panel-stats panel-stats--3" aria-label="Este mes">
      <div className="panel-stat">
        <b>{stats.leads}</b>
        <span>consultas este mes</span>
      </div>
      <div className="panel-stat">
        <b>{stats.clientes}</b>
        <span>ya son clientes</span>
      </div>
      <div className="panel-stat">
        <b>{stats.valueGs > 0 ? formatGs(stats.valueGs) : "₲ 0"}</b>
        <span>vendido a ellos</span>
      </div>
    </div>
  );
}

export function CrmTabs({
  active,
  counts,
  hrefFor,
}: {
  active: CrmTab;
  counts: Record<CrmTab, number>;
  hrefFor: (tab: CrmTab) => string;
}) {
  return (
    <nav className="panel-tabs" aria-label="Filtrar clientes">
      {CRM_TABS.map((tab) => (
        <Link key={tab} href={hrefFor(tab)} className={tab === active ? "panel-tab panel-tab--on" : "panel-tab"} aria-current={tab === active ? "page" : undefined}>
          {TAB_LABELS[tab]} <span className="panel-tab-n">{counts[tab]}</span>
        </Link>
      ))}
    </nav>
  );
}

export function CrmPager({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="panel-pager" aria-label="Páginas">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="panel-btn panel-btn--ghost panel-btn--small">
          ← Anteriores
        </Link>
      ) : (
        <span />
      )}
      <span className="hint">
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className="panel-btn panel-btn--ghost panel-btn--small">
          Siguientes →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function CrmLeadList({
  leads,
  repeats,
  today,
  businessName,
  readOnly,
  reply,
  empty,
}: {
  leads: SiteLead[];
  repeats: Map<string, number>;
  today: string;
  businessName: string;
  readOnly: boolean;
  reply: (formData: FormData) => Promise<void>;
  empty: string;
}) {
  if (leads.length === 0) return <p className="hint">{empty}</p>;
  return (
    <ul className="panel-leads">
      {leads.map((lead) => {
        const follow = dayOf(lead.followUpDay);
        const due = isFollowUpDue(lead.followUpDay, lead.status, today);
        const times = repeats.get(lead.phone) ?? 1;
        const day = lead.requestedDay ? toDayString(lead.requestedDay) : null;
        const replyLabel = `Responder por WhatsApp · ${displayPhone(lead.phone)}`;
        return (
          <li key={lead.id} className={`panel-lead panel-lead--${lead.status}`}>
            <div className="panel-lead-head">
              <strong>{lead.name}</strong>
              {times > 1 ? <span className="panel-chip">{times} consultas</span> : null}
              <span className="hint">
                {KIND_LABELS[lead.kind] ?? lead.kind} · {dateTimeEs(new Date(lead.createdAt))} · {statusLabel(lead.status)}
                {lead.source ? ` · ${leadSourceLabel(lead.source)}` : ""}
              </span>
            </div>
            {lead.kind === "turno" ? (
              <p>
                {lead.serviceName ? `${lead.serviceName} · ` : ""}
                {day ? dayEs(day) : ""}
                {lead.requestedTime ? ` a las ${lead.requestedTime}` : ""}
              </p>
            ) : null}
            {lead.message ? <p className="panel-lead-msg">{lead.message}</p> : null}
            {lead.notes ? <p className="panel-lead-msg hint">{lead.notes}</p> : null}
            {follow || lead.valueGs ? (
              <p className="hint">
                {follow ? <span className={due ? "panel-due" : undefined}>Escribirle el {dayEs(follow)}</span> : null}
                {follow && lead.valueGs ? " · " : ""}
                {lead.valueGs ? formatGs(lead.valueGs) : ""}
              </p>
            ) : null}
            <div className="panel-lead-actions">
              {readOnly ? (
                <a
                  href={waLink(lead.phone, crmReplyMessage({ name: lead.name, kind: lead.kind, serviceName: lead.serviceName, requestedDay: day, requestedTime: lead.requestedTime }, businessName))}
                  target="_blank"
                  rel="noreferrer"
                  className="panel-btn panel-btn--small"
                >
                  {replyLabel}
                </a>
              ) : (
                <form action={reply}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <button type="submit" className="panel-btn panel-btn--small">
                    {replyLabel}
                  </button>
                </form>
              )}
            </div>
            {readOnly ? null : (
              <details className="panel-lead-edit">
                <summary>Editar estado, notas y seguimiento</summary>
                <LeadEditForm leadId={lead.id} status={lead.status} notes={lead.notes ?? ""} followUpDay={follow ?? ""} valueGs={lead.valueGs} />
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
