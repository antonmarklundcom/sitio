"use client";

import { useActionState } from "react";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/business";
import type { RegistroState } from "@/app/registro/actions";

export function RegistroForm({ action, refCode = "" }: { action: (state: RegistroState, data: FormData) => Promise<RegistroState>; refCode?: string }) {
  const [state, submit, pending] = useActionState(action, {});
  if (state.ok) return <p role="status">{state.ok}</p>;
  return (
    <form action={submit} className="panel-card" noValidate>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {([['name', 'Nombre de tu negocio'], ['category', 'Rubro'], ['phone', 'Número de WhatsApp'], ['city', 'Ciudad (opcional)']] as const).map(([key, label]) => (
        <div className="panel-field" key={key}>
          <label htmlFor={key}>{label}</label>
          {key === "category" ? (
            <select id={key} name={key} defaultValue={state.values?.[key] ?? ""} aria-invalid={!!state.fieldErrors?.[key]} aria-describedby={`${key}-error`} required>
              <option value="">Elegí tu rubro</option>
              {CATEGORIES.map(category => <option key={category} value={category}>{CATEGORY_LABELS[category].split(" / ")[0]}</option>)}
            </select>
          ) : (
            <input id={key} name={key} type={key === "phone" ? "tel" : "text"} defaultValue={state.values?.[key] ?? (key === "city" ? "Asunción" : "")} autoComplete={key === "phone" ? "tel" : key === "name" ? "organization" : "address-level2"} required={key !== "city"} aria-invalid={!!state.fieldErrors?.[key]} aria-describedby={`${key}-error${key === "phone" ? " phone-hint" : ""}`} />
          )}
          {key === "phone" ? <p id="phone-hint" className="hint">Ej: 0981 123 456</p> : null}
          <p id={`${key}-error`} className="err" aria-live="polite">{state.fieldErrors?.[key]}</p>
        </div>
      ))}
      {refCode ? <input type="hidden" name="ref" value={refCode} /> : null}
      <input type="text" name="website" hidden tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className="panel-btn" type="submit" disabled={pending}>{pending ? "Creando…" : "Crear mi página"}</button>
    </form>
  );
}
