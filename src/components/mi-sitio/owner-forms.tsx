"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { WEEKDAYS } from "@/lib/business";
import { OWNER_MAX_SERVICES } from "@/lib/owner-form";
import { ACCEPT_ATTR, MAX_UPLOAD_BYTES } from "@/lib/media-shared";
import type { OwnerFormState } from "@/app/mi-sitio/actions";

/** Owner-panelen. Spanska (voseo) — det här är kundens yta, inte adminets. */

function Submit({ label, busy = "Guardando…" }: { label: string; busy?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="panel-btn">
      {pending ? busy : label}
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

export type OwnerDefaults = {
  name: string;
  description: string;
  address: string;
  zone: string;
  city: string;
  secondaryPhone: string;
  mapsUrl: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  services: { name: string; desc?: string }[];
  hours: Record<string, { open: string; close: string }[] | null>;
};

export function OwnerEditForm({
  action,
  defaults,
}: {
  action: (state: OwnerFormState, formData: FormData) => Promise<OwnerFormState>;
  defaults: OwnerDefaults;
}) {
  const [state, formAction] = useActionState<OwnerFormState, FormData>(action, {});
  const err = (k: string) => state.fieldErrors?.[k];
  const services = [...defaults.services, ...Array(OWNER_MAX_SERVICES).fill(null)].slice(0, OWNER_MAX_SERVICES);

  return (
    <form action={formAction}>
      {state.error ? <p className="panel-note panel-note--err">{state.error}</p> : null}
      {state.ok ? <p className="panel-note panel-note--ok">{state.ok}</p> : null}

      <div className="panel-card">
        <h2>Tus textos</h2>
        <Field label="Nombre del negocio" name="name" error={err("name")}>
          <input id="name" name="name" type="text" defaultValue={defaults.name} maxLength={120} required />
        </Field>
        <Field
          label="Descripción"
          name="description"
          hint="Es el texto que se ve en tu página. Mínimo 80 caracteres."
          error={err("description")}
        >
          <textarea id="description" name="description" defaultValue={defaults.description} maxLength={2000} required />
        </Field>
      </div>

      <div className="panel-card">
        <h2>Servicios o productos</h2>
        <p>Al menos dos. El primero es el que más se destaca en tu página.</p>
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
        <h2>Dónde estás</h2>
        <div className="panel-row panel-row--2">
          <Field label="Ciudad" name="city" error={err("city")}>
            <input id="city" name="city" type="text" defaultValue={defaults.city} maxLength={80} required />
          </Field>
          <Field label="Barrio o zona" name="zone" error={err("zone")}>
            <input id="zone" name="zone" type="text" defaultValue={defaults.zone} maxLength={80} />
          </Field>
        </div>
        <Field label="Dirección" name="address" error={err("address")}>
          <input id="address" name="address" type="text" defaultValue={defaults.address} maxLength={200} />
        </Field>
        <Field label="Link de Google Maps" name="mapsUrl" error={err("mapsUrl")}>
          <input id="mapsUrl" name="mapsUrl" type="url" defaultValue={defaults.mapsUrl} maxLength={300} />
        </Field>
        <Field
          label="Otro teléfono"
          name="secondaryPhone"
          hint="Tu WhatsApp principal lo cambiamos nosotros — escribinos, porque hay que verificarlo de nuevo."
          error={err("secondaryPhone")}
        >
          <input id="secondaryPhone" name="secondaryPhone" type="tel" defaultValue={defaults.secondaryPhone} />
        </Field>
      </div>

      <div className="panel-card">
        <h2>Redes</h2>
        <Field label="Instagram" name="instagram" error={err("instagram")}>
          <input id="instagram" name="instagram" type="url" defaultValue={defaults.instagram} maxLength={300} />
        </Field>
        <Field label="Facebook" name="facebook" error={err("facebook")}>
          <input id="facebook" name="facebook" type="url" defaultValue={defaults.facebook} maxLength={300} />
        </Field>
        <Field label="TikTok" name="tiktok" error={err("tiktok")}>
          <input id="tiktok" name="tiktok" type="url" defaultValue={defaults.tiktok} maxLength={300} />
        </Field>
      </div>

      <div className="panel-card">
        <h2>Horario</h2>
        <p>Podés poner dos turnos por día — mañana y tarde.</p>
        <div className="panel-hours">
          {WEEKDAYS.map((day) => {
            const intervals = defaults.hours?.[day.key] ?? null;
            const closed = intervals === null;
            return (
              <div key={day.key} className="panel-hours-day">
                <div className="panel-hours-head">
                  <span className="day">{day.short}</span>
                  <span className="closed">
                    <input
                      id={`hours.${day.key}.closed`}
                      name={`hours.${day.key}.closed`}
                      type="checkbox"
                      defaultChecked={closed}
                    />
                    <label htmlFor={`hours.${day.key}.closed`}>Cerrado</label>
                  </span>
                </div>
                {[0, 1].map((slot) => (
                  <div key={slot} className="panel-hours-slot">
                    <input
                      name={`hours.${day.key}.${slot}.open`}
                      type="time"
                      defaultValue={intervals?.[slot]?.open ?? (slot === 0 && !closed ? "08:00" : "")}
                      aria-label={`${day.label} turno ${slot + 1} desde`}
                    />
                    <input
                      name={`hours.${day.key}.${slot}.close`}
                      type="time"
                      defaultValue={intervals?.[slot]?.close ?? (slot === 0 && !closed ? "17:00" : "")}
                      aria-label={`${day.label} turno ${slot + 1} hasta`}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel-actions">
        <Submit label="Guardar cambios" />
      </div>
    </form>
  );
}

export function OwnerPhotos({
  photos,
  logoUrl,
  heroMediaId,
  maxPhotos,
  setHero,
  deletePhoto,
}: {
  photos: { id: number; url: string }[];
  logoUrl: string | null;
  heroMediaId: number | null;
  maxPhotos: number;
  setHero: (formData: FormData) => Promise<void>;
  deletePhoto: (formData: FormData) => Promise<void>;
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
        body.set("kind", kind);
        body.set("file", file);
        // Inget businessId: för en owner-session tar rutten det ur sessionen,
        // och det finns därför inget fält att manipulera.
        const res = await fetch("/api/upload", { method: "POST", body });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "No pudimos subir la foto.");
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
        {logoUrl ? (
          <div className="panel-photos panel-photos--logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" />
          </div>
        ) : null}
        <label className="panel-btn panel-btn--ghost">
          {busy ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo"}
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
        <h2>
          Fotos ({photos.length}/{maxPhotos})
        </h2>
        <p>La foto marcada como principal es la que se ve arriba de todo en tu página.</p>
        <div className="panel-photos">
          {photos.map((photo) => (
            <figure key={photo.id} className={photo.id === heroMediaId ? "is-hero" : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" loading="lazy" />
              <figcaption>
                {photo.id === heroMediaId ? (
                  <span className="tag">Principal</span>
                ) : (
                  <form action={setHero}>
                    <input type="hidden" name="mediaId" value={photo.id} />
                    <button type="submit">Hacer principal</button>
                  </form>
                )}
                {photos.length > 1 ? (
                  <form action={deletePhoto}>
                    <input type="hidden" name="mediaId" value={photo.id} />
                    <button type="submit" className="danger">
                      Borrar
                    </button>
                  </form>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
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
