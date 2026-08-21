"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { CATEGORIES, CATEGORY_LABELS, WEEKDAYS } from "@/lib/business";
import { MAX_UPLOAD_BYTES, ACCEPT_ATTR } from "@/lib/media-shared";
import type { IntakeState } from "@/app/alta/[token]/actions";

/**
 * Kundens formulär. Spanska (voseo) genomgående — det här är den enda ytan i
 * produkten där företagaren själv skriver, och den ska inte kännas som ett
 * adminsystem.
 */

function Submit({ label, busyLabel = "Guardando…", ghost }: { label: string; busyLabel?: string; ghost?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`panel-btn${ghost ? " panel-btn--ghost" : ""}`}>
      {pending ? busyLabel : label}
    </button>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-field">
      <label htmlFor={name}>{label}</label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}

export type IntakeDefaults = {
  name: string;
  category: string;
  rawDescription: string;
  whatsappPhone: string;
  secondaryPhone: string;
  address: string;
  zone: string;
  city: string;
  instagram: string;
  facebook: string;
  services: { name: string; desc?: string }[];
  hours: Record<string, { open: string; close: string }[] | null>;
};

export function IntakeDataForm({
  action,
  defaults,
}: {
  action: (state: IntakeState, formData: FormData) => Promise<IntakeState>;
  defaults: IntakeDefaults;
}) {
  const [state, formAction] = useActionState<IntakeState, FormData>(action, {});
  const err = (k: string) => state.fieldErrors?.[k];
  const services = [...defaults.services, ...Array(5).fill(null)].slice(0, 5);

  return (
    <form action={formAction}>
      {state.error ? <p className="panel-note panel-note--err">{state.error}</p> : null}

      <div className="panel-card">
        <h2>Tu negocio</h2>
        <Field label="Nombre del negocio" name="name" error={err("name")}>
          <input id="name" name="name" type="text" defaultValue={defaults.name} maxLength={120} required />
        </Field>
        <Field label="Rubro" name="category" error={err("category")}>
          <select id="category" name="category" defaultValue={defaults.category}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c].split(" / ")[0]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Contanos qué hacés"
          name="rawDescription"
          hint="Escribí como hablás. Nosotros lo pulimos antes de publicar."
          error={err("rawDescription")}
        >
          <textarea
            id="rawDescription"
            name="rawDescription"
            defaultValue={defaults.rawDescription}
            maxLength={2000}
            required
          />
        </Field>
      </div>

      <div className="panel-card">
        <h2>Servicios o productos</h2>
        <p>Al menos dos. Lo que más te piden va primero.</p>
        {services.map((service, i) => (
          <div key={i} className="panel-row panel-row--2">
            <Field label={`${i + 1}. Nombre`} name={`service.${i}.name`} error={err(`service.${i}.name`)}>
              <input
                id={`service.${i}.name`}
                name={`service.${i}.name`}
                type="text"
                defaultValue={service?.name ?? ""}
                maxLength={120}
              />
            </Field>
            <Field label="Detalle (opcional)" name={`service.${i}.desc`}>
              <input
                id={`service.${i}.desc`}
                name={`service.${i}.desc`}
                type="text"
                defaultValue={service?.desc ?? ""}
                maxLength={300}
              />
            </Field>
          </div>
        ))}
      </div>

      <div className="panel-card">
        <h2>Cómo te contactan</h2>
        <Field
          label="WhatsApp"
          name="whatsappPhone"
          hint="Es el número al que van a escribirte los clientes. Lo verificamos en el último paso."
          error={err("whatsappPhone")}
        >
          <input
            id="whatsappPhone"
            name="whatsappPhone"
            type="tel"
            inputMode="tel"
            defaultValue={defaults.whatsappPhone}
            placeholder="0981 123 456"
            required
          />
        </Field>
        <Field label="Otro teléfono (opcional)" name="secondaryPhone" error={err("secondaryPhone")}>
          <input id="secondaryPhone" name="secondaryPhone" type="tel" defaultValue={defaults.secondaryPhone} />
        </Field>
        <div className="panel-row panel-row--2">
          <Field label="Ciudad" name="city" error={err("city")}>
            <input id="city" name="city" type="text" defaultValue={defaults.city} maxLength={80} required />
          </Field>
          <Field label="Barrio o zona" name="zone" error={err("zone")}>
            <input id="zone" name="zone" type="text" defaultValue={defaults.zone} maxLength={80} />
          </Field>
        </div>
        <Field label="Dirección (opcional)" name="address" error={err("address")}>
          <input id="address" name="address" type="text" defaultValue={defaults.address} maxLength={200} />
        </Field>
        <div className="panel-row panel-row--2">
          <Field label="Instagram (link)" name="instagram" error={err("instagram")}>
            <input id="instagram" name="instagram" type="url" defaultValue={defaults.instagram} maxLength={300} />
          </Field>
          <Field label="Facebook (link)" name="facebook" error={err("facebook")}>
            <input id="facebook" name="facebook" type="url" defaultValue={defaults.facebook} maxLength={300} />
          </Field>
        </div>
      </div>

      <div className="panel-card">
        <h2>Horario</h2>
        <p>Un horario por día. Si cerrás al mediodía, lo arreglamos nosotros después.</p>
        <div className="panel-hours">
          {WEEKDAYS.map((day) => {
            const interval = defaults.hours?.[day.key]?.[0];
            return (
              <div key={day.key} className="panel-hours-row">
                <label className="day" htmlFor={`hours.${day.key}.open`}>
                  {day.short}
                </label>
                <input
                  id={`hours.${day.key}.open`}
                  name={`hours.${day.key}.open`}
                  type="time"
                  defaultValue={interval?.open ?? "08:00"}
                />
                <input name={`hours.${day.key}.close`} type="time" defaultValue={interval?.close ?? "17:00"} />
                <span className="closed">
                  <input
                    id={`hours.${day.key}.closed`}
                    name={`hours.${day.key}.closed`}
                    type="checkbox"
                    defaultChecked={defaults.hours ? defaults.hours[day.key] === null : day.key === "sun"}
                  />
                  <label htmlFor={`hours.${day.key}.closed`}>Cerrado</label>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel-actions">
        <Submit label="Guardar y seguir" />
      </div>
    </form>
  );
}

export function IntakePhotos({
  token,
  photos,
  hasLogo,
  maxPhotos,
}: {
  token: string;
  photos: { id: number; url: string }[];
  hasLogo: boolean;
  maxPhotos: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(kind: "logo" | "photo", files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_UPLOAD_BYTES) {
          setError(`${file.name} pesa más de 10 MB.`);
          continue;
        }
        const body = new FormData();
        body.set("token", token);
        body.set("kind", kind);
        body.set("file", file);
        const res = await fetch("/api/upload", { method: "POST", body });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "No pudimos subir la foto. Probá de nuevo.");
          break;
        }
      }
      const el = inputs.current[kind];
      if (el) el.value = "";
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error ? <p className="panel-note panel-note--err">{error}</p> : null}

      <div className="panel-card">
        <h2>Tu logo</h2>
        <p>Si no tenés, no pasa nada — seguimos sin logo.</p>
        <label className="panel-btn panel-btn--ghost">
          {busy ? "Subiendo…" : hasLogo ? "Cambiar logo" : "Subir logo"}
          <input
            ref={(el) => {
              inputs.current.logo = el;
            }}
            type="file"
            accept={ACCEPT_ATTR}
            hidden
            disabled={busy}
            onChange={(e) => upload("logo", e.currentTarget.files)}
          />
        </label>
      </div>

      <div className="panel-card">
        <h2>Fotos ({photos.length}/{maxPhotos})</h2>
        <p>Fotos reales de tu local, tus trabajos o tus productos. Sacadas con el celular está perfecto.</p>
        {photos.length > 0 ? (
          <div className="panel-photos">
            {photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={photo.id} src={photo.url} alt="" loading="lazy" />
            ))}
          </div>
        ) : null}
        <label className="panel-btn panel-btn--ghost">
          {busy ? "Subiendo…" : "Subir fotos"}
          <input
            ref={(el) => {
              inputs.current.photo = el;
            }}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            hidden
            disabled={busy || photos.length >= maxPhotos}
            onChange={(e) => upload("photo", e.currentTarget.files)}
          />
        </label>
      </div>
    </div>
  );
}

export function IntakeVerification({
  requestCode,
  verifyCode,
  phone,
  verified,
}: {
  requestCode: (state: IntakeState, formData: FormData) => Promise<IntakeState>;
  verifyCode: (state: IntakeState, formData: FormData) => Promise<IntakeState>;
  phone: string;
  verified: boolean;
}) {
  const [reqState, reqAction] = useActionState<IntakeState, FormData>(requestCode, {});
  const [verState, verAction] = useActionState<IntakeState, FormData>(verifyCode, {});

  if (verified) {
    return (
      <div className="panel-card">
        <h2>Número verificado ✓</h2>
        <p>Tu WhatsApp {phone} está confirmado. Ya podés enviar tus datos.</p>
      </div>
    );
  }

  return (
    <div className="panel-card">
      <h2>Verificá tu WhatsApp</h2>
      <p>
        Te mandamos un código de 6 números al {phone}. Es para confirmar que el número es tuyo — es el número
        al que van a escribirte tus clientes.
      </p>

      {reqState.error ? <p className="panel-note panel-note--err">{reqState.error}</p> : null}
      {reqState.ok ? <p className="panel-note panel-note--ok">{reqState.ok}</p> : null}

      <form action={reqAction} style={{ marginBottom: "1rem" }}>
        <Submit label="Pedir el código" busyLabel="Pidiendo…" ghost />
      </form>

      <form action={verAction}>
        {verState.error ? <p className="panel-note panel-note--err">{verState.error}</p> : null}
        {verState.ok ? <p className="panel-note panel-note--ok">{verState.ok}</p> : null}
        <Field label="Código" name="code" error={verState.fieldErrors?.code}>
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
        </Field>
        <Submit label="Verificar" busyLabel="Verificando…" />
      </form>
    </div>
  );
}

export function IntakeSubmit({
  action,
  disabled,
}: {
  action: (state: IntakeState, formData: FormData) => Promise<IntakeState>;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState<IntakeState, FormData>(action, {});

  return (
    <form action={formAction}>
      {state.error ? <p className="panel-note panel-note--err">{state.error}</p> : null}
      <div className="panel-actions">
        <button type="submit" className="panel-btn" disabled={disabled}>
          Enviar mis datos
        </button>
      </div>
      {disabled ? <p className="hint">Completá los pasos anteriores para poder enviar.</p> : null}
    </form>
  );
}
