"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { OwnerCodeState } from "@/app/admin/(dashboard)/accesos/actions";

/**
 * Genererar en inloggningskod och visar den en gång, med en färdig wa.me-länk.
 * Koden lagras bara som hash — den går inte att läsa upp igen. Svenska:
 * superadmin-UI.
 */
export function OwnerCodeButton({
  action,
  businessName,
  phone,
}: {
  action: (state: OwnerCodeState, formData: FormData) => Promise<OwnerCodeState>;
  businessName: string;
  phone: string;
}) {
  const [state, formAction] = useActionState<OwnerCodeState, FormData>(action, {});
  const { pending } = useFormStatus();

  if (state.code) {
    const href = `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
      `Tu código para entrar a tu página es ${state.code}. Vence en 10 minutos. Entrá en sitio.com.py/mi-sitio`,
    )}`;
    return (
      <div className="text-right">
        <div className="font-mono text-lg tracking-[0.3em] tabular-nums">{state.code}</div>
        <a href={href} target="_blank" rel="noreferrer" className="text-xs text-admin-accent hover:underline">
          Skicka till {businessName} →
        </a>
        <p className="text-[11px] text-admin-muted">Visas bara nu.</p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.error ? <span className="block text-xs text-admin-danger">{state.error}</span> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-admin-line px-2.5 py-1.5 text-xs hover:border-admin-muted"
      >
        Generera kod
      </button>
    </form>
  );
}
