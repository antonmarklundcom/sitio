"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { formatGs } from "@/lib/format";
import { MENU_MAX_ITEMS_PER_SECTION, MENU_MAX_SECTIONS } from "@/lib/menu-form";
import type { MenuSectionRow } from "@/db/menu-queries";
import type { MenuFormState } from "@/app/mi-sitio/menu-actions";

/**
 * Menyredigeraren i owner-panelen. Spanska (voseo) — kundens yta.
 *
 * Formulären är avsiktligt dumma: ett fält per sak, inga modaler, ingen
 * drag-and-drop. Den här vyn öppnas på en telefon i ett kök, ofta av någon som
 * aldrig sett ett admingränssnitt, och en tappad rätt är värre än ett extra
 * klick.
 */

function Submit({ label, busy = "Guardando…" }: { label: string; busy?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="panel-btn">
      {pending ? busy : label}
    </button>
  );
}

function ItemForm({
  sectionId,
  item,
  save,
  onDone,
}: {
  sectionId: number;
  item?: MenuSectionRow["items"][number];
  save: (state: MenuFormState, formData: FormData) => Promise<MenuFormState>;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState<MenuFormState, FormData>(async (prev, formData) => {
    const result = await save(prev, formData);
    if (result.ok && onDone) onDone();
    return result;
  }, {});

  return (
    <form action={formAction} className="panel-menu-form">
      <input type="hidden" name="sectionId" value={sectionId} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      {state.error ? <p className="panel-note panel-note--err">{state.error}</p> : null}

      <div className="panel-field">
        <label htmlFor={`item-name-${item?.id ?? `new-${sectionId}`}`}>Nombre</label>
        <input
          id={`item-name-${item?.id ?? `new-${sectionId}`}`}
          name="name"
          type="text"
          defaultValue={item?.name ?? ""}
          maxLength={120}
          required
        />
      </div>

      <div className="panel-field">
        <label htmlFor={`item-desc-${item?.id ?? `new-${sectionId}`}`}>Detalle (opcional)</label>
        <input
          id={`item-desc-${item?.id ?? `new-${sectionId}`}`}
          name="description"
          type="text"
          defaultValue={item?.description ?? ""}
          maxLength={300}
        />
      </div>

      <div className="panel-field">
        <label htmlFor={`item-price-${item?.id ?? `new-${sectionId}`}`}>Precio en guaraníes</label>
        <input
          id={`item-price-${item?.id ?? `new-${sectionId}`}`}
          name="priceGs"
          type="text"
          inputMode="numeric"
          defaultValue={item?.priceGs != null ? String(item.priceGs) : ""}
          placeholder="45000"
        />
        <p className="hint">Dejalo vacío y en tu página va a decir “A consultar”.</p>
      </div>

      <label className="panel-check">
        <input type="checkbox" name="isAvailable" defaultChecked={item ? item.isAvailable : true} />
        Hay hoy
      </label>

      <div className="panel-actions">
        <Submit label={item ? "Guardar plato" : "Agregar plato"} />
      </div>
    </form>
  );
}

export function OwnerMenu({
  menu,
  addSection,
  renameSection,
  deleteSection,
  moveSection,
  saveItem,
  deleteItem,
  toggleAvailability,
  moveItem,
}: {
  menu: MenuSectionRow[];
  addSection: (state: MenuFormState, formData: FormData) => Promise<MenuFormState>;
  renameSection: (formData: FormData) => Promise<void>;
  deleteSection: (formData: FormData) => Promise<void>;
  moveSection: (formData: FormData) => Promise<void>;
  saveItem: (state: MenuFormState, formData: FormData) => Promise<MenuFormState>;
  deleteItem: (formData: FormData) => Promise<void>;
  toggleAvailability: (formData: FormData) => Promise<void>;
  moveItem: (formData: FormData) => Promise<void>;
}) {
  const [addState, addAction] = useActionState<MenuFormState, FormData>(addSection, {});
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const totalItems = menu.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="panel-card">
      <h2>Tu carta</h2>
      <p>
        Lo que cargues acá sale en tu página con el precio al lado. Los platos marcados como “no hay hoy”
        desaparecen de la página, pero quedan guardados acá para cuando vuelvan.
      </p>

      {addState.error ? <p className="panel-note panel-note--err">{addState.error}</p> : null}
      {addState.ok ? <p className="panel-note panel-note--ok">{addState.ok}</p> : null}

      {menu.map((section, si) => (
        <div key={section.id} className="panel-menu-section">
          <div className="panel-menu-head">
            <form action={renameSection} className="panel-menu-rename">
              <input type="hidden" name="sectionId" value={section.id} />
              <input
                name="name"
                type="text"
                defaultValue={section.name}
                maxLength={80}
                aria-label={`Nombre de la sección ${section.name}`}
              />
              <button type="submit">Renombrar</button>
            </form>
            <span className="panel-photo-order">
              <form action={moveSection}>
                <input type="hidden" name="sectionId" value={section.id} />
                <input type="hidden" name="direction" value="up" />
                <button type="submit" disabled={si === 0} aria-label={`Subir la sección ${section.name}`}>
                  ↑
                </button>
              </form>
              <form action={moveSection}>
                <input type="hidden" name="sectionId" value={section.id} />
                <input type="hidden" name="direction" value="down" />
                <button
                  type="submit"
                  disabled={si === menu.length - 1}
                  aria-label={`Bajar la sección ${section.name}`}
                >
                  ↓
                </button>
              </form>
            </span>
            <form action={deleteSection}>
              <input type="hidden" name="sectionId" value={section.id} />
              <button type="submit" className="danger">
                Borrar sección
              </button>
            </form>
          </div>

          {section.items.length === 0 ? (
            <p className="hint">Esta sección todavía no tiene platos.</p>
          ) : (
            <ul className="panel-menu-items">
              {section.items.map((item, ii) => (
                <li key={item.id} className={item.isAvailable ? undefined : "is-off"}>
                  <div className="panel-menu-item">
                    <span className="name">{item.name}</span>
                    <span className="price">{formatGs(item.priceGs)}</span>
                  </div>
                  {item.description ? <p className="hint">{item.description}</p> : null}
                  <div className="panel-menu-item-actions">
                    <form action={toggleAvailability}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <button type="submit">{item.isAvailable ? "No hay hoy" : "Volvió"}</button>
                    </form>
                    <button type="button" onClick={() => setEditing(editing === item.id ? null : item.id)}>
                      {editing === item.id ? "Cerrar" : "Editar"}
                    </button>
                    <span className="panel-photo-order">
                      <form action={moveItem}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button type="submit" disabled={ii === 0} aria-label={`Subir ${item.name}`}>
                          ↑
                        </button>
                      </form>
                      <form action={moveItem}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={ii === section.items.length - 1}
                          aria-label={`Bajar ${item.name}`}
                        >
                          ↓
                        </button>
                      </form>
                    </span>
                    <form action={deleteItem}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <button type="submit" className="danger">
                        Borrar
                      </button>
                    </form>
                  </div>

                  {editing === item.id ? (
                    <ItemForm
                      sectionId={section.id}
                      item={item}
                      save={saveItem}
                      onDone={() => setEditing(null)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {adding === section.id ? (
            <ItemForm sectionId={section.id} save={saveItem} onDone={() => setAdding(null)} />
          ) : (
            <button
              type="button"
              className="panel-btn panel-btn--ghost"
              disabled={section.items.length >= MENU_MAX_ITEMS_PER_SECTION}
              onClick={() => setAdding(section.id)}
            >
              Agregar plato a “{section.name}”
            </button>
          )}
        </div>
      ))}

      <form action={addAction} className="panel-menu-add">
        <div className="panel-field">
          <label htmlFor="new-section">Nueva sección</label>
          <input
            id="new-section"
            name="name"
            type="text"
            maxLength={80}
            placeholder="Entradas, Bebidas, Postres…"
            required
            disabled={menu.length >= MENU_MAX_SECTIONS}
          />
        </div>
        <Submit label="Agregar sección" />
      </form>

      <p className="hint">
        {menu.length}/{MENU_MAX_SECTIONS} secciones · {totalItems} plato{totalItems === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
