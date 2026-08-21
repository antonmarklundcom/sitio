"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { OwnerLoginState } from "./actions";

/**
 * Inloggning för företagaren. Spanska (voseo) — det här är kundens yta.
 *
 * Två steg i samma vy: nummer först, sedan kod. Ingen lösenordsåterställning
 * att glömma, och numret är redan verifierat i intaken (PLAN.md D1).
 */
function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="panel-btn">
      {pending ? busy : label}
    </button>
  );
}

export function OwnerLoginForm({
  requestCode,
  verifyCode,
}: {
  requestCode: (state: OwnerLoginState, formData: FormData) => Promise<OwnerLoginState>;
  verifyCode: (state: OwnerLoginState, formData: FormData) => Promise<OwnerLoginState>;
}) {
  const [reqState, reqAction] = useActionState<OwnerLoginState, FormData>(requestCode, {});
  const [verState, verAction] = useActionState<OwnerLoginState, FormData>(verifyCode, {});

  const phone = verState.phone ?? reqState.phone ?? "";
  const showCode = (verState.step ?? reqState.step) === "code";

  return (
    <div className="panel-card">
      <h2>Entrá a tu página</h2>
      <p>
        Te mandamos un código por WhatsApp al número de tu negocio. No hay contraseña que recordar.
      </p>

      {reqState.error ? <p className="panel-note panel-note--err">{reqState.error}</p> : null}
      {reqState.ok ? <p className="panel-note panel-note--ok">{reqState.ok}</p> : null}

      <form action={reqAction}>
        <div className="panel-field">
          <label htmlFor="phone">Tu WhatsApp</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={phone}
            placeholder="0981 123 456"
            required
          />
        </div>
        <Submit label={showCode ? "Pedir otro código" : "Pedir código"} busy="Pidiendo…" />
      </form>

      {showCode ? (
        <form action={verAction} style={{ marginTop: "1.5rem" }}>
          <input type="hidden" name="phone" value={phone} />
          {verState.error ? <p className="panel-note panel-note--err">{verState.error}</p> : null}
          <div className="panel-field">
            <label htmlFor="code">Código</label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="panel-code"
              placeholder="000000"
              required
            />
            <p className="hint">Vence a los 10 minutos. Si no te llega, pedí otro.</p>
          </div>
          <Submit label="Entrar" busy="Entrando…" />
        </form>
      ) : null}
    </div>
  );
}
