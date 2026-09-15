"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CATEGORIES, CATEGORY_LABELS, type HoursMap } from "@/lib/business";
import type { BusinessFormState } from "@/app/admin/(dashboard)/sitios/actions";
import { Card, Notice, SectionTitle } from "./ui";
import { Field, HoursEditor, Select, ServicesEditor, TextArea, TextInput } from "./fields";
import { PresentationBlock } from "./theme-picker";

export type BusinessFormDefaults = {
  name: string;
  slug: string;
  category: string;
  rawDescription: string | null;
  description: string | null;
  services: { name: string; desc?: string }[];
  whatsappPhone: string;
  secondaryPhone: string | null;
  address: string | null;
  zone: string | null;
  city: string;
  lat: string | null;
  lng: string | null;
  mapsUrl: string | null;
  socials: { instagram?: string; facebook?: string; tiktok?: string };
  hours: HoursMap;
  ruc: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  adminNotes: string | null;
};

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Guardando…" : label}
    </button>
  );
}

export function BusinessForm({
  action,
  defaults,
  submitLabel,
  slugLocked,
}: {
  action: (state: BusinessFormState, formData: FormData) => Promise<BusinessFormState>;
  defaults: BusinessFormDefaults;
  submitLabel: string;
  /** Slug ändras bara medvetet — låset skyddar en publicerad sajts ranking. */
  slugLocked?: boolean;
}) {
  const [state, formAction] = useActionState<BusinessFormState, FormData>(action, {});
  const err = (k: string) => state.fieldErrors?.[k];

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

      <Card>
        <SectionTitle hint="El nombre y el enlace son lo que ve el cliente. Solo vos podés cambiar el enlace.">
          Datos básicos
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del negocio" name="name" required error={err("name")}>
            <TextInput name="name" defaultValue={defaults.name} maxLength={120} required />
          </Field>

          <Field
            label="Enlace (slug)"
            name="slug"
            required
            error={err("slug")}
            hint={
              slugLocked
                ? "El sitio está publicado. Cambiar el enlace crea una redirección 301 desde el anterior."
                : "sitio.com.py/<enlace> — solo minúsculas, números y guiones."
            }
          >
            <TextInput name="slug" defaultValue={defaults.slug} maxLength={60} required placeholder="electricidad-mendoza" />
          </Field>

          <Field label="Rubro" name="category" required error={err("category")}>
            <Select
              name="category"
              defaultValue={defaults.category}
              options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
            />
          </Field>

          <PresentationBlock defaultCategory={defaults.category} />
        </div>
      </Card>

      <Card>
        <SectionTitle hint="El texto original del cliente nunca se sobrescribe. La descripción es el texto pulido que se publica.">
          Textos
        </SectionTitle>
        <div className="space-y-4">
          <Field label="Texto original del cliente" name="rawDescription" error={err("rawDescription")}>
            <TextArea name="rawDescription" defaultValue={defaults.rawDescription} rows={3} maxLength={2000} />
          </Field>
          <Field
            label="Descripción (se publica)"
            name="description"
            error={err("description")}
            hint="Se requieren al menos 80 caracteres para publicar; el contenido escaso no se posiciona."
          >
            <TextArea name="description" defaultValue={defaults.description} rows={5} maxLength={2000} />
          </Field>
          <Field label="Servicios" name="services" error={err("servicesJson")} hint="Se requieren al menos dos para publicar.">
            <ServicesEditor defaultValue={defaults.services} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="El número de WhatsApp es el punto de contacto principal. Escribí 0981 123 456 o +595 981 123 456.">
          Contacto
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp" name="whatsappPhone" required error={err("whatsappPhone")}>
            <TextInput name="whatsappPhone" defaultValue={defaults.whatsappPhone} required placeholder="0981 123 456" />
          </Field>
          <Field label="Teléfono alternativo" name="secondaryPhone" error={err("secondaryPhone")}>
            <TextInput name="secondaryPhone" defaultValue={defaults.secondaryPhone} placeholder="021 234 567" />
          </Field>
          <Field label="Dirección" name="address" error={err("address")}>
            <TextInput name="address" defaultValue={defaults.address} maxLength={200} />
          </Field>
          <Field label="Zona / barrio" name="zone" error={err("zone")}>
            <TextInput name="zone" defaultValue={defaults.zone} maxLength={80} />
          </Field>
          <Field label="Ciudad" name="city" required error={err("city")}>
            <TextInput name="city" defaultValue={defaults.city} maxLength={80} required />
          </Field>
          <Field label="Enlace de Google Maps" name="mapsUrl" error={err("mapsUrl")}>
            <TextInput name="mapsUrl" defaultValue={defaults.mapsUrl} placeholder="https://maps.app.goo.gl/…" />
          </Field>
          <Field label="Latitud" name="lat" error={err("lat")} hint="Opcional: agrega la ubicación al esquema LocalBusiness.">
            <TextInput name="lat" defaultValue={defaults.lat} placeholder="-25.2867" />
          </Field>
          <Field label="Longitud" name="lng" error={err("lng")}>
            <TextInput name="lng" defaultValue={defaults.lng} placeholder="-57.3333" />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="Determina 'Abierto ahora' en el sitio y openingHoursSpecification en el esquema.">
          Horario
        </SectionTitle>
        <HoursEditor defaultValue={defaults.hours} />
      </Card>

      <Card>
        <SectionTitle>Enlaces de redes sociales</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Instagram" name="social.instagram" error={err("socialsJson.instagram")}>
            <TextInput name="social.instagram" defaultValue={defaults.socials.instagram ?? ""} />
          </Field>
          <Field label="Facebook" name="social.facebook" error={err("socialsJson.facebook")}>
            <TextInput name="social.facebook" defaultValue={defaults.socials.facebook ?? ""} />
          </Field>
          <Field label="TikTok" name="social.tiktok" error={err("socialsJson.tiktok")}>
            <TextInput name="social.tiktok" defaultValue={defaults.socials.tiktok ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="Si los dejás vacíos, se generan a partir del nombre, el rubro y la zona.">SEO</SectionTitle>
        <div className="space-y-4">
          <Field label="Título SEO" name="seoTitle" error={err("seoTitle")} hint="Máximo 70 caracteres.">
            <TextInput name="seoTitle" defaultValue={defaults.seoTitle} maxLength={70} />
          </Field>
          <Field
            label="Descripción SEO"
            name="seoDescription"
            error={err("seoDescription")}
            hint="Máximo 160 caracteres. Se requiere para publicar."
          >
            <TextArea name="seoDescription" defaultValue={defaults.seoDescription} rows={2} maxLength={160} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>Uso interno</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="RUC" name="ruc" error={err("ruc")} hint="Opcional, para la factura del cliente.">
            <TextInput name="ruc" defaultValue={defaults.ruc} maxLength={20} />
          </Field>
          <Field label="Notas (solo las ves vos)" name="adminNotes" error={err("adminNotes")}>
            <TextArea name="adminNotes" defaultValue={defaults.adminNotes} rows={3} maxLength={2000} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <SaveButton label={submitLabel} />
      </div>
    </form>
  );
}
