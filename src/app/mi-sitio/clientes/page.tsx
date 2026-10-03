import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { todayAsuncion } from "@/lib/billing";
import { PAGE_SIZE, TAB_STATUSES, CRM_TABS, parsePage, parseSearch, parseTab, type CrmTab } from "@/lib/crm";
import {
  leadCountsByStatus,
  listDueLeads,
  listLeads,
  monthStats,
  repeatCounts,
  resolveCrmScope,
} from "@/db/crm-queries";
import { CrmLeadList, CrmPager, CrmStats, CrmTabs } from "@/components/mi-sitio/owner-crm";
import { AddCustomerForm, RefCodeForm } from "@/components/mi-sitio/owner-crm-forms";
import { replyWhatsappAction } from "../crm-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis clientes", robots: { index: false, follow: false } };

type SP = { sitio?: string; tab?: string; q?: string; p?: string };

export default async function ClientesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireRole("owner", "superadmin");
  const sp = await searchParams;

  // Samma regler som /mi-sitio: ägaren ser sin egen sajt, superadmin pekar ut en
  // med ?sitio=<id> och får en skrivskyddad vy.
  const scope = await resolveCrmScope(sp.sitio);
  if (!scope) {
    if (session.role === "superadmin") {
      return (
        <div className="panel-wrap">
          <h1>Mis clientes</h1>
          <p>
            Du är inloggad som superadmin. Lägg till <code>?sitio=&lt;id&gt;</code> för att se en kunds vy.
          </p>
        </div>
      );
    }
    redirect("/mi-sitio/login");
  }
  const { business, readOnly } = scope;

  const tab = parseTab(sp.tab);
  const search = parseSearch(sp.q);
  const q = String(sp.q ?? "").trim().slice(0, 60);
  const page = parsePage(sp.p);
  const today = todayAsuncion();

  const [byStatus, due, list, stats] = await Promise.all([
    leadCountsByStatus(business.id),
    listDueLeads(business.id, today),
    listLeads(business.id, { tab, search, page, pageSize: PAGE_SIZE }),
    monthStats(business.id, today),
  ]);
  // En grupperad fråga för båda listorna ("3 consultas"), inte en per rad.
  const repeats = await repeatCounts(business.id, [...due, ...list.rows].map((l) => l.phone));

  const counts = Object.fromEntries(
    CRM_TABS.map((t) => {
      const statuses = TAB_STATUSES[t];
      return [t, statuses ? statuses.reduce((n, s) => n + (byStatus[s] ?? 0), 0) : Object.values(byStatus).reduce((a, b) => a + b, 0)];
    }),
  ) as Record<CrmTab, number>;

  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const hrefFor = (over: { tab?: CrmTab; p?: number }) => {
    const params = new URLSearchParams();
    if (readOnly && sp.sitio) params.set("sitio", sp.sitio);
    params.set("tab", over.tab ?? tab);
    if (q) params.set("q", q);
    if (over.p && over.p > 1) params.set("p", String(over.p));
    return `/mi-sitio/clientes?${params.toString()}`;
  };
  const siteQuery = readOnly && sp.sitio ? `?sitio=${encodeURIComponent(sp.sitio)}` : "";

  const emptyText = q
    ? "No encontramos a nadie con esa búsqueda."
    : counts.todas === 0
      ? "Cuando alguien deje su número en tu página, aparece acá. También podés agregar clientes vos."
      : "No hay nadie en esta lista todavía.";

  return (
    <div className="panel-wrap">
      <div className="panel-top">
        <span className="site">{business.name}</span>
        <Link href={`/mi-sitio${siteQuery}`}>← Mi sitio</Link>
      </div>

      <h1>Mis clientes</h1>
      <p>Tus consultas y tus clientes, todo en un lugar. Escribís desde tu propio WhatsApp.</p>
      {readOnly ? <p className="panel-note">Vista de solo lectura.</p> : null}

      <CrmStats stats={stats} />

      {due.length > 0 ? (
        <div className="panel-card panel-card--due" id="para-hoy">
          <h2>
            Para hoy <span className="panel-badge">{due.length}</span>
          </h2>
          <p className="hint">Les dijiste que les ibas a escribir.</p>
          <CrmLeadList leads={due} repeats={repeats} today={today} businessName={business.name} readOnly={readOnly} reply={replyWhatsappAction} empty="" />
        </div>
      ) : null}

      {readOnly ? null : (
        <>
          <details className="panel-card panel-fold">
            <summary>Agregar cliente</summary>
            <AddCustomerForm />
          </details>
          <details className="panel-card panel-fold">
            <summary>Registrar chat por código</summary>
            <p className="hint">
              Cuando alguien te escribe desde el botón de tu página, su primer mensaje trae un código (“ref K7Q2”). Cargalo acá y
              te anotamos de dónde vino.
            </p>
            <RefCodeForm />
          </details>
        </>
      )}

      <div className="panel-card" id="lista">
        <CrmTabs active={tab} counts={counts} hrefFor={(t) => hrefFor({ tab: t })} />
        <form method="get" className="panel-search" role="search">
          {readOnly && sp.sitio ? <input type="hidden" name="sitio" value={sp.sitio} /> : null}
          <input type="hidden" name="tab" value={tab} />
          <input type="text" name="q" defaultValue={q} maxLength={60} placeholder="Buscar por nombre o número" aria-label="Buscar por nombre o número" />
          <button type="submit" className="panel-btn panel-btn--ghost panel-btn--small">
            Buscar
          </button>
        </form>
        <CrmLeadList leads={list.rows} repeats={repeats} today={today} businessName={business.name} readOnly={readOnly} reply={replyWhatsappAction} empty={emptyText} />
        <CrmPager page={Math.min(page, pages)} pages={pages} hrefFor={(p) => hrefFor({ p })} />
      </div>

      <p>
        <a href={`/mi-sitio/clientes/export${siteQuery}`} className="panel-btn panel-btn--ghost panel-btn--small">
          Descargar mis clientes (CSV)
        </a>
      </p>
    </div>
  );
}
