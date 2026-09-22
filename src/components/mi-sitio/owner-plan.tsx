"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { formatGs } from "@/lib/format";
import { ACCEPT_ATTR } from "@/lib/media-shared";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/billing";
import type { PaymentReportState } from "@/app/mi-sitio/payment-actions";

/**
 * "Tu plan" i owner-panelen (R3-21, PR-19b): vad kunden har, när det går ut,
 * och ett formulär för att själv rapportera en betalning. Rapporten förlänger
 * ingenting förrän vi bekräftat den — texten säger det, så att ingen tror att
 * ett uppladdat kvitto är ett betalt år.
 *
 * Spanska (voseo) — kundens yta.
 */

const STATUS_ES: Record<string, string> = {
  trial: "Prueba gratis",
  active: "Al día",
  grace: "Vencido — tu página sigue arriba unos días",
  expired: "Vencido",
  canceled: "Cancelado",
};

function dayEs(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="panel-btn">
      {pending ? "Enviando…" : "Informar pago"}
    </button>
  );
}

export function OwnerPlan({
  planLabel,
  status,
  expiresAt,
  priceGs,
  pendingSince,
  readOnly = false,
  reportPayment,
}: {
  planLabel: string;
  status: string;
  expiresAt: string;
  priceGs: number;
  /** Dagen en rapport som väntar på bekräftelse skickades, annars null. */
  pendingSince: string | null;
  /** Superadmin som tittar via ?sitio=: kortet visas, formuläret inte. */
  readOnly?: boolean;
  reportPayment: (state: PaymentReportState, formData: FormData) => Promise<PaymentReportState>;
}) {
  const [state, formAction] = useActionState(reportPayment, {});

  return (
    <div className="panel-card" id="plan">
      <h2>Tu plan</h2>
      <p>
        Plan {planLabel} · {STATUS_ES[status] ?? status} · {status === "trial" ? "la prueba termina" : "vence"} el{" "}
        {dayEs(expiresAt)}. Precio: {formatGs(priceGs)} por año.
      </p>

      {state.ok ? <p className="panel-note panel-note--ok">{state.ok}</p> : null}
      {state.error ? <p className="panel-note panel-note--err">{state.error}</p> : null}

      {readOnly ? null : pendingSince || state.ok ? (
        <p className="hint">
          {pendingSince
            ? `Informaste un pago el ${dayEs(pendingSince)}. Lo estamos revisando; cuando lo confirmemos, la fecha de arriba se corre un año.`
            : null}
        </p>
      ) : (
        <form action={formAction} className="panel-menu-form">
          <p className="hint">
            ¿Ya pagaste? Contanos cómo y mandanos el comprobante. Tu plan se extiende cuando confirmamos el pago.
          </p>
          <div className="panel-field">
            <label htmlFor="pay-method">Cómo pagaste</label>
            <select id="pay-method" name="method" defaultValue="transferencia">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="panel-field">
            <label htmlFor="pay-reference">Número de operación</label>
            <input id="pay-reference" name="reference" type="text" maxLength={120} />
          </div>
          <div className="panel-field">
            <label htmlFor="pay-amount">Monto en guaraníes</label>
            <input
              id="pay-amount"
              name="amountGs"
              type="text"
              inputMode="numeric"
              defaultValue={String(priceGs)}
              required
            />
          </div>
          <div className="panel-field">
            <label htmlFor="pay-receipt">Foto del comprobante</label>
            <input id="pay-receipt" name="receipt" type="file" accept={ACCEPT_ATTR} />
            <p className="hint">Con el número de operación o la foto nos alcanza.</p>
          </div>
          <div className="panel-actions">
            <Submit />
          </div>
        </form>
      )}
    </div>
  );
}
