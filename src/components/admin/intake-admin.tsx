"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/business";
import type { IntakeAdminState, OtpState } from "@/app/admin/(dashboard)/alta/actions";
import { Card, Notice, SectionTitle } from "./ui";
import { Field, Select, TextInput } from "./fields";

/** Svenska: superadmin-UI. */
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Creando…" : label}
    </button>
  );
}

export function CreateIntakeLinkForm({
  action,
}: {
  action: (state: IntakeAdminState, formData: FormData) => Promise<IntakeAdminState>;
}) {
  const [state, formAction] = useActionState<IntakeAdminState, FormData>(action, {});

  return (
    <Card>
      <SectionTitle hint="Crea un borrador y un enlace válido por 14 días. El cliente completa sus datos; solo necesitás el nombre para empezar.">
        Nuevo enlace de Altas
      </SectionTitle>

      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}

      <form action={formAction} className="grid gap-4 sm:grid-cols-4">
        <Field label="Nombre del negocio" name="name" required error={state.fieldErrors?.name}>
          <TextInput name="name" required maxLength={120} placeholder="Pizzería La Nona" />
        </Field>
        <Field label="WhatsApp (opcional)" name="phone" error={state.fieldErrors?.phone}>
          <TextInput name="phone" placeholder="0981 123 456" />
        </Field>
        <Field label="Ciudad" name="city">
          <TextInput name="city" defaultValue="Asunción" maxLength={80} />
        </Field>
        <Field label="Rubro" name="category">
          <Select
            name="category"
            defaultValue="otro"
            options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          />
        </Field>
        <div className="sm:col-span-4">
          <Submit label="Crear enlace" />
        </div>
      </form>
    </Card>
  );
}

/**
 * Genererar en OTP-kod och visar den EN gång. Koden lagras bara som hash — den
 * går inte att läsa upp igen, och det är avsiktligt. Tappar du bort den
 * genererar du en ny.
 */
export function OtpButton({
  action,
  businessName,
  phone,
}: {
  action: (state: OtpState, formData: FormData) => Promise<OtpState>;
  businessName: string;
  phone: string;
}) {
  // useFormStatus() här läste statusen för ett formulär OVANFÖR komponenten —
  // det finns inget — så knappen var aldrig upptagen (R3-42).
  const [state, formAction, pending] = useActionState<OtpState, FormData>(action, {});

  if (state.code) {
    const waHref = `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
      `Tu código de verificación para sitio.com.py es ${state.code}. Vence en 10 minutos.`,
    )}`;
    return (
      <div className="text-right">
        <div className="font-mono text-lg tracking-[0.3em] tabular-nums">{state.code}</div>
        <a href={waHref} target="_blank" rel="noreferrer" className="text-xs text-admin-accent hover:underline">
          Enviar a {businessName} →
        </a>
        <p className="text-[11px] text-admin-muted">Se muestra solo ahora. Si perdés el código, generá uno nuevo.</p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.error ? <span className="text-xs text-admin-danger">{state.error}</span> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-admin-line px-2.5 py-1.5 text-xs hover:border-admin-muted"
      >
        {pending ? "Generando…" : "Generar código"}
      </button>
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(url)}
      title={url}
      className="font-mono text-xs text-admin-muted hover:text-admin-text"
    >
      Copiar enlace
    </button>
  );
}
