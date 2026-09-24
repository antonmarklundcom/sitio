"use client";

import { useState } from "react";
import { LEAD_LIMITS } from "@/lib/growth";

/**
 * "Dejanos tu número" / "Pedí un turno" (growth-1). WhatsApp-knappen ovanför
 * är fortfarande huvudvägen; formuläret är för besökaren som hellre blir
 * kontaktad. Allt som skickas hamnar i ägarens inkorg i /mi-sitio.
 *
 * Postar JSON till /api/consulta — kundsajterna är ISR, så ingen server
 * action med per-request-state här. Honeypot-fältet `website` ska vara tomt.
 */

type Props = {
  businessId: number;
  booking: boolean;
  services: string[];
};

type Status = { state: "idle" | "sending" | "done" | "error"; error?: string; fieldErrors?: Record<string, string>; wa?: string };

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function LeadForm({ businessId, booking, services }: Props) {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const kind = booking ? "turno" : "consulta";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setStatus({ state: "sending" });
    try {
      const res = await fetch("/api/consulta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, b: businessId, kind }),
      });
      const body = (await res.json().catch(() => ({}))) as Status & { ok?: boolean };
      if (res.ok && body.ok) setStatus({ state: "done", wa: body.wa });
      else setStatus({ state: "error", error: body.error ?? "No pudimos enviar. Probá de nuevo.", fieldErrors: body.fieldErrors });
    } catch {
      setStatus({ state: "error", error: "No pudimos enviar. Revisá tu conexión." });
    }
  }

  if (status.state === "done") {
    return (
      <div className="lead-form lead-form--done" role="status">
        <p>
          <strong>¡Listo!</strong> {booking ? "Recibimos tu pedido de turno." : "Recibimos tu consulta."} Te vamos a escribir
          por WhatsApp.
        </p>
        {status.wa ? (
          <a href={status.wa} target="_blank" rel="noreferrer noopener" className="btn btn--quiet btn--block" data-ev="whatsapp_click" data-ev-loc="formulario">
            ¿Apurado? Escribinos ahora
          </a>
        ) : null}
      </div>
    );
  }

  const err = status.fieldErrors ?? {};
  const today = todayIso();

  return (
    <details className="lead-form" open={booking}>
      <summary>{booking ? "Pedí tu turno acá" : "¿Preferís que te escribamos? Dejanos tu número"}</summary>
      <form onSubmit={onSubmit} noValidate>
        {status.state === "error" && status.error ? <p className="lead-err" role="alert">{status.error}</p> : null}
        <label>
          Tu nombre
          <input name="name" required maxLength={LEAD_LIMITS.name} autoComplete="name" aria-invalid={!!err.name} />
          {err.name ? <span className="lead-err">{err.name}</span> : null}
        </label>
        <label>
          Tu WhatsApp
          <input name="phone" type="tel" required inputMode="tel" placeholder="0981 123 456" autoComplete="tel" aria-invalid={!!err.phone} />
          {err.phone ? <span className="lead-err">{err.phone}</span> : null}
        </label>
        {booking ? (
          <>
            {services.length > 0 ? (
              <label>
                Servicio
                <select name="service" defaultValue="">
                  <option value="">Elegí (opcional)</option>
                  {services.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="lead-row">
              <label>
                Día
                <input name="day" type="date" required min={today} aria-invalid={!!err.day} />
                {err.day ? <span className="lead-err">{err.day}</span> : null}
              </label>
              <label>
                Hora
                <input name="time" type="time" step={900} aria-invalid={!!err.time} />
                {err.time ? <span className="lead-err">{err.time}</span> : null}
              </label>
            </div>
            <label>
              Comentario (opcional)
              <textarea name="message" rows={2} maxLength={LEAD_LIMITS.message} />
            </label>
          </>
        ) : (
          <label>
            ¿Qué necesitás?
            <textarea name="message" rows={3} required maxLength={LEAD_LIMITS.message} aria-invalid={!!err.message} />
            {err.message ? <span className="lead-err">{err.message}</span> : null}
          </label>
        )}
        <input type="text" name="website" hidden tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button type="submit" className="btn btn--primary btn--block" disabled={status.state === "sending"}>
          {status.state === "sending" ? "Enviando…" : booking ? "Pedir turno" : "Enviar"}
        </button>
      </form>
    </details>
  );
}
