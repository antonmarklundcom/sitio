"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { saveNotifyEmailAction, sendTestPushAction, type NotifyState } from "@/app/mi-sitio/notify-actions";

/**
 * "Avisos" i owner-panelen (crm-1): Web Push till telefonen plus ett valfritt
 * mejl för nya consultas. Spanska (voseo) — kundens yta.
 *
 * Props: vapidPublicKey (process.env.VAPID_PUBLIC_KEY, tom sträng = av),
 * notifyEmail (business.notifyEmail), readOnly (true i superadmins vy).
 */

type Status = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "active" | "error";

function urlBase64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/mi-sitio/");
  return reg ? reg.pushManager.getSubscription() : null;
}

export function OwnerNotify({
  vapidPublicKey,
  notifyEmail,
  readOnly = false,
}: {
  vapidPublicKey: string;
  notifyEmail: string | null;
  readOnly?: boolean;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [emailState, emailAction, emailPending] = useActionState<NotifyState, FormData>(saveNotifyEmailAction, {});

  useEffect(() => {
    let alive = true;
    (async () => {
      let next: Status;
      if (!vapidPublicKey) next = "unsupported";
      else if (isIos() && !isStandalone()) next = "ios-install";
      else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else next = (await currentSubscription().catch(() => null)) ? "active" : "off";
      if (alive) setStatus(next);
    })();
    return () => {
      alive = false;
    };
  }, [vapidPublicKey]);

  async function enable() {
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/mi-sitio/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(vapidPublicKey) }));
      const json = sub.toJSON();
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("active");
      setMessage("Listo. Te vamos a avisar en este teléfono.");
    } catch {
      setStatus("error");
      setMessage("No pudimos activar los avisos. Probá de nuevo.");
    }
  }

  async function disable() {
    setMessage(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("Avisos desactivados en este teléfono.");
    } catch {
      setMessage("No pudimos desactivarlos. Probá de nuevo.");
    }
  }

  function test() {
    setMessage(null);
    startTransition(async () => {
      const res = await sendTestPushAction();
      setMessage(res.error ?? res.ok ?? null);
    });
  }

  return (
    <section className="panel-card" aria-labelledby="avisos-title">
      <h2 id="avisos-title">Avisos</h2>
      <p>Recibí una notificación gratis en tu teléfono cada vez que alguien te escribe o pide un turno desde tu página.</p>

      {status === "loading" && <p aria-live="polite">Revisando tu teléfono…</p>}

      {status === "unsupported" && (
        <p>Este navegador no permite avisos. Probá abrir el panel desde Chrome en tu teléfono, o recibí los avisos por email acá abajo.</p>
      )}

      {status === "ios-install" && (
        <p>
          En iPhone primero tenés que instalar el panel: tocá el botón Compartir de Safari, elegí &quot;Agregar a pantalla de inicio&quot;, abrí
          &quot;Mi sitio&quot; desde el ícono nuevo y volvé acá.
        </p>
      )}

      {status === "denied" && (
        <p>Bloqueaste los avisos para este sitio. Activalos desde los ajustes de notificaciones de tu navegador y volvé a entrar.</p>
      )}

      {!readOnly && (status === "off" || status === "error") && (
        <button type="button" className="panel-btn" onClick={enable}>
          Activar avisos en este teléfono
        </button>
      )}

      {!readOnly && status === "active" && (
        <>
          <p>Los avisos están activos en este teléfono.</p>
          <div className="panel-actions">
            <button type="button" className="panel-btn" onClick={test} disabled={busy}>
              Enviar aviso de prueba
            </button>
            <button type="button" className="panel-btn panel-btn--ghost" onClick={disable}>
              Desactivar
            </button>
          </div>
        </>
      )}

      {readOnly && status === "active" && <p>Los avisos están activos en este teléfono.</p>}

      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}

      <form action={emailAction} style={{ marginTop: "1.25rem" }}>
        <div className="panel-field">
          <label htmlFor="notifyEmail">También avisarme por email</label>
          <input
            id="notifyEmail"
            name="notifyEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={190}
            defaultValue={notifyEmail ?? ""}
            placeholder="tu@email.com"
            disabled={readOnly}
            style={{ width: "100%", font: "inherit", border: "1px solid var(--line)", borderRadius: 10, padding: "0.7rem 0.75rem" }}
          />
          <p className="hint">Dejalo vacío si no querés emails.</p>
          {emailState.error && <p className="err">{emailState.error}</p>}
          {emailState.ok && <p className="hint" role="status">{emailState.ok}</p>}
        </div>
        {!readOnly && (
          <button type="submit" className="panel-btn panel-btn--ghost" disabled={emailPending}>
            Guardar email
          </button>
        )}
      </form>
    </section>
  );
}
