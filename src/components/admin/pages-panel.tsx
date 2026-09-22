"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Card, Notice, SectionTitle } from "./ui";
import { PAGES_MAX, PAGE_BODY_MAX, PAGE_TYPES, PAGE_TYPE_DEFAULTS, type PageType } from "@/lib/pages";
import type { PageFormState } from "@/app/admin/(dashboard)/sitios/page-actions";

/**
 * Extra sidor i adminet (R3-25, PR-18): skapa, redigera, slå av/på, sortera,
 * ta bort. Kunden ser bara titel + text i /mi-sitio.
 */

const inputBase =
  "w-full rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2 text-sm text-admin-text outline-none placeholder:text-admin-muted/60 focus:border-admin-accent";

const TYPE_LABELS: Record<PageType, string> = {
  servicios: "Servicios",
  nosotros: "Nosotros",
  galeria: "Galería",
  menu: "Carta",
  productos: "Productos",
  contacto: "Contacto",
  custom: "Personalizada",
};

type PageView = { id: number; pageSlug: string; type: PageType; title: string; body: string; isEnabled: boolean };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Guardando…" : label}
    </button>
  );
}

function PageEditor({
  page,
  index,
  count,
  publicHref,
  updatePage,
  deletePage,
  movePage,
}: {
  page: PageView;
  index: number;
  count: number;
  publicHref: string;
  updatePage: (state: PageFormState, formData: FormData) => Promise<PageFormState>;
  deletePage: (formData: FormData) => Promise<void>;
  movePage: (formData: FormData) => Promise<void>;
}) {
  const [state, action] = useActionState(updatePage, {});
  const id = `page-${page.id}`;

  return (
    <li className="rounded-lg border border-admin-line p-4" data-page-slug={page.pageSlug}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <a href={publicHref} target="_blank" rel="noreferrer" className="font-mono text-admin-accent hover:underline">
          /{page.pageSlug}
        </a>
        <span className="text-admin-muted">{TYPE_LABELS[page.type]}</span>
        {page.isEnabled ? null : <span className="text-admin-warn">Oculta</span>}
        <span className="ml-auto flex items-center gap-1">
          <form action={movePage}>
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="direction" value="up" />
            <button type="submit" disabled={index === 0} aria-label={`Subir ${page.title}`} className="px-2 disabled:opacity-30">
              ↑
            </button>
          </form>
          <form action={movePage}>
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              disabled={index === count - 1}
              aria-label={`Bajar ${page.title}`}
              className="px-2 disabled:opacity-30"
            >
              ↓
            </button>
          </form>
          <form action={deletePage}>
            <input type="hidden" name="pageId" value={page.id} />
            <button type="submit" className="px-2 text-admin-danger hover:underline">
              Borrar página
            </button>
          </form>
        </span>
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="pageId" value={page.id} />
        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
        {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
        <div>
          <label htmlFor={`${id}-title`} className="mb-1.5 block text-sm text-admin-muted">
            Título
          </label>
          <input id={`${id}-title`} name="title" defaultValue={page.title} maxLength={120} required className={inputBase} />
        </div>
        <div>
          <label htmlFor={`${id}-body`} className="mb-1.5 block text-sm text-admin-muted">
            Texto (una línea en blanco separa párrafos)
          </label>
          <textarea
            id={`${id}-body`}
            name="body"
            rows={6}
            maxLength={PAGE_BODY_MAX}
            defaultValue={page.body}
            className={inputBase}
          />
          <p className="mt-1 text-xs text-admin-muted">{PAGE_TYPE_DEFAULTS[page.type].hint}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isEnabled" defaultChecked={page.isEnabled} />
          Visible en el sitio
        </label>
        <SubmitButton label="Guardar página" />
      </form>
    </li>
  );
}

export function PagesPanel({
  pages,
  slug,
  previewToken,
  createPage,
  updatePage,
  deletePage,
  movePage,
}: {
  pages: PageView[];
  slug: string;
  previewToken: string;
  createPage: (state: PageFormState, formData: FormData) => Promise<PageFormState>;
  updatePage: (state: PageFormState, formData: FormData) => Promise<PageFormState>;
  deletePage: (formData: FormData) => Promise<void>;
  movePage: (formData: FormData) => Promise<void>;
}) {
  const [createState, create] = useActionState(createPage, {});
  const taken = new Set(pages.map((p) => p.pageSlug));

  return (
    <Card>
      <SectionTitle hint="Hasta 6 páginas. Aparecen como enlaces bajo la portada y en el mapa del sitio. El cliente puede cambiar título y texto en /mi-sitio; crear, ocultar, ordenar y borrar se hace acá.">
        Páginas adicionales
      </SectionTitle>

      {pages.length > 0 ? (
        <ul className="mb-6 space-y-4">
          {pages.map((page, i) => (
            <PageEditor
              key={page.id}
              page={page}
              index={i}
              count={pages.length}
              publicHref={`/${slug}/${page.pageSlug}?preview=${previewToken}`}
              updatePage={updatePage}
              deletePage={deletePage}
              movePage={movePage}
            />
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-admin-muted">Todavía no hay páginas.</p>
      )}

      {pages.length < PAGES_MAX ? (
        <form action={create} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="new-page-type" className="mb-1.5 block text-sm text-admin-muted">
              Tipo
            </label>
            <select id="new-page-type" name="type" defaultValue="nosotros" className={inputBase}>
              {PAGE_TYPES.map((t) => (
                <option key={t} value={t} disabled={t !== "custom" && taken.has(PAGE_TYPE_DEFAULTS[t].slug)}>
                  {TYPE_LABELS[t]}
                  {t !== "custom" ? ` (/${PAGE_TYPE_DEFAULTS[t].slug})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-page-title" className="mb-1.5 block text-sm text-admin-muted">
              Título (opcional salvo en personalizada)
            </label>
            <input id="new-page-title" name="title" maxLength={120} className={inputBase} />
          </div>
          <SubmitButton label="Crear página" />
          {createState.error ? (
            <div className="sm:col-span-3">
              <Notice tone="danger">{createState.error}</Notice>
            </div>
          ) : null}
          {createState.ok ? (
            <div className="sm:col-span-3">
              <Notice tone="ok">{createState.ok}</Notice>
            </div>
          ) : null}
        </form>
      ) : (
        <p className="text-sm text-admin-muted">Llegaste al máximo de {PAGES_MAX} páginas.</p>
      )}
    </Card>
  );
}
