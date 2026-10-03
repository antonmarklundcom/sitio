"use client";

import { useActionState } from "react";
import { addCustomerAction, registerRefCustomerAction, updateLeadAction, type CrmFormState } from "@/app/mi-sitio/crm-actions";
import { kept, keepSubmittedOnError, type KeptState } from "@/lib/kept-form";
import { selectableStatuses, statusLabel } from "@/lib/crm";

/**
 * Formulären i "Mis clientes" (crm-1). Klientkomponenter bara för att
 * useActionState visar fel och behåller det ägaren skrev (kept-form).
 * Spanska (voseo) — kundens yta.
 */

const addAction = keepSubmittedOnError<CrmFormState>(addCustomerAction);
const refAction = keepSubmittedOnError<CrmFormState>(registerRefCustomerAction);
const editAction = keepSubmittedOnError<CrmFormState>(updateLeadAction);

type State = CrmFormState & KeptState;

function Notes({ state }: { state: State }) {
  return (
    <>
      {state.ok ? <p className="panel-note panel-note--ok">{state.ok}</p> : null}
      {state.error ? <p className="panel-note panel-note--err">{state.error}</p> : null}
    </>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}

export function AddCustomerForm() {
  const [state, action, pending] = useActionState<State, FormData>(addAction, {});
  const s = state.submitted;
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action}>
      <Notes state={state} />
      <div className="panel-row panel-row--2">
        <Field id="add-name" label="Nombre" error={fe.name}>
          <input id="add-name" name="name" type="text" maxLength={80} required defaultValue={kept(s, "name", "")} aria-invalid={!!fe.name} />
        </Field>
        <Field id="add-phone" label="WhatsApp" error={fe.phone}>
          <input id="add-phone" name="phone" type="tel" inputMode="tel" required placeholder="0981 123 456" defaultValue={kept(s, "phone", "")} aria-invalid={!!fe.phone} />
        </Field>
      </div>
      <Field id="add-note" label="Nota (opcional)" error={fe.note}>
        <textarea id="add-note" name="note" maxLength={2000} rows={3} defaultValue={kept(s, "note", "")} />
      </Field>
      <Field id="add-follow" label="Acordarme de escribirle el… (opcional)" error={fe.followUpDay}>
        <input id="add-follow" name="followUpDay" type="date" defaultValue={kept(s, "followUpDay", "")} />
      </Field>
      <button type="submit" disabled={pending} className="panel-btn panel-btn--small">
        {pending ? "Guardando…" : "Agregar cliente"}
      </button>
    </form>
  );
}

export function RefCodeForm() {
  const [state, action, pending] = useActionState<State, FormData>(refAction, {});
  const s = state.submitted;
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action}>
      <Notes state={state} />
      <Field
        id="ref-code"
        label="Código del chat"
        error={fe.code}
        hint="Es el que aparece en el primer mensaje del cliente, por ejemplo “ref K7Q2”."
      >
        <input id="ref-code" name="code" type="text" maxLength={12} required autoCapitalize="characters" autoComplete="off" placeholder="K7Q2" defaultValue={kept(s, "code", "")} aria-invalid={!!fe.code} />
      </Field>
      <div className="panel-row panel-row--2">
        <Field id="ref-name" label="Nombre del cliente" error={fe.name}>
          <input id="ref-name" name="name" type="text" maxLength={80} required defaultValue={kept(s, "name", "")} aria-invalid={!!fe.name} />
        </Field>
        <Field id="ref-phone" label="Su número" error={fe.phone}>
          <input id="ref-phone" name="phone" type="tel" inputMode="tel" required placeholder="0981 123 456" defaultValue={kept(s, "phone", "")} aria-invalid={!!fe.phone} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className="panel-btn panel-btn--small">
        {pending ? "Registrando…" : "Registrar chat"}
      </button>
    </form>
  );
}

export function LeadEditForm({
  leadId,
  status,
  notes,
  followUpDay,
  valueGs,
}: {
  leadId: number;
  status: string;
  notes: string;
  followUpDay: string;
  valueGs: number | null;
}) {
  const [state, action, pending] = useActionState<State, FormData>(editAction, {});
  const s = state.submitted;
  const fe = state.fieldErrors ?? {};
  const id = `lead-${leadId}`;
  return (
    <form action={action}>
      <input type="hidden" name="leadId" value={leadId} />
      <Notes state={state} />
      <div className="panel-row panel-row--2">
        <Field id={`${id}-status`} label="Estado" error={fe.status}>
          <select id={`${id}-status`} name="status" defaultValue={kept(s, "status", status)}>
            {selectableStatuses(status).map((st) => (
              <option key={st} value={st}>
                {statusLabel(st)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-follow`} label="Escribirle el…" error={fe.followUpDay}>
          <input id={`${id}-follow`} name="followUpDay" type="date" defaultValue={kept(s, "followUpDay", followUpDay)} />
        </Field>
      </div>
      <Field id={`${id}-value`} label="Cuánto compró (₲)" error={fe.valueGs} hint="Solo para vos. Por ejemplo 150.000.">
        <input id={`${id}-value`} name="valueGs" type="text" inputMode="numeric" placeholder="150.000" defaultValue={kept(s, "valueGs", valueGs == null ? "" : String(valueGs))} aria-invalid={!!fe.valueGs} />
      </Field>
      <Field id={`${id}-notes`} label="Notas" error={fe.notes}>
        <textarea id={`${id}-notes`} name="notes" maxLength={2000} rows={3} defaultValue={kept(s, "notes", notes)} />
      </Field>
      <button type="submit" disabled={pending} className="panel-btn panel-btn--small">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
