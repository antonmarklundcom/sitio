"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PAGE_BODY_MAX } from "@/lib/pages";
import type { OwnerPageState } from "@/app/mi-sitio/page-actions";

/**
 * Kundens extra sidor (R3-25): titel och text, en sida i taget. Nya sidor
 * skapar vi — texten skriver kunden. Spanska (voseo).
 */

type OwnerPage = { id: number; pageSlug: string; title: string; body: string; isEnabled: boolean };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="panel-btn">
      {pending ? "Guardando…" : "Guardar página"}
    </button>
  );
}

function PageForm({
  page,
  siteHref,
  save,
}: {
  page: OwnerPage;
  siteHref: string;
  save: (state: OwnerPageState, formData: FormData) => Promise<OwnerPageState>;
}) {
  const [state, action] = useActionState(save, {});
  return (
    <form action={action} className="panel-menu-form" data-page-slug={page.pageSlug}>
      <input type="hidden" name="pageId" value={page.id} />
      <p className="hint">
        <a href={`${siteHref}/${page.pageSlug}`} target="_blank" rel="noreferrer">
          /{page.pageSlug}
        </a>
        {page.isEnabled ? null : " · oculta por ahora"}
      </p>
      {state.error ? <p className="panel-note panel-note--err">{state.error}</p> : null}
      {state.ok ? <p className="panel-note panel-note--ok">{state.ok}</p> : null}
      <div className="panel-field">
        <label htmlFor={`page-title-${page.id}`}>Título</label>
        <input id={`page-title-${page.id}`} name="title" type="text" defaultValue={page.title} maxLength={120} required />
      </div>
      <div className="panel-field">
        <label htmlFor={`page-body-${page.id}`}>Texto</label>
        <textarea id={`page-body-${page.id}`} name="body" rows={6} maxLength={PAGE_BODY_MAX} defaultValue={page.body} />
        <p className="hint">Dejá una línea en blanco entre párrafos.</p>
      </div>
      <div className="panel-actions">
        <Submit />
      </div>
    </form>
  );
}

export function OwnerPages({
  pages,
  siteHref,
  save,
}: {
  pages: OwnerPage[];
  siteHref: string;
  save: (state: OwnerPageState, formData: FormData) => Promise<OwnerPageState>;
}) {
  if (pages.length === 0) return null;
  return (
    <div className="panel-card">
      <h2>Tus páginas</h2>
      <p>El texto de cada página es tuyo. Si querés una página nueva, escribinos.</p>
      {pages.map((page) => (
        <PageForm key={page.id} page={page} siteHref={siteHref} save={save} />
      ))}
    </div>
  );
}
