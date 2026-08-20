"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  THEME_KEYS,
  THEME_LABELS,
  type HoursMap,
} from "@/lib/business";
import type { BusinessFormState } from "@/app/admin/(dashboard)/sitios/actions";
import { Card, Notice, SectionTitle } from "./ui";
import { Field, HoursEditor, Select, ServicesEditor, TextArea, TextInput } from "./fields";

export type BusinessFormDefaults = {
  name: string;
  slug: string;
  category: string;
  themeKey: string;
  paletteVariant: number;
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
      {pending ? "Sparar…" : label}
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
        <SectionTitle hint="Namnet och länken är det kunden ser. Länken ändras bara av dig.">
          Grunduppgifter
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Företagsnamn" name="name" required error={err("name")}>
            <TextInput name="name" defaultValue={defaults.name} maxLength={120} required />
          </Field>

          <Field
            label="Länk (slug)"
            name="slug"
            required
            error={err("slug")}
            hint={
              slugLocked
                ? "Sajten är publicerad. Byte skapar en 301 från den gamla länken."
                : "sitio.com.py/<länk> — bara små bokstäver, siffror och bindestreck."
            }
          >
            <TextInput name="slug" defaultValue={defaults.slug} maxLength={60} required placeholder="electricidad-mendoza" />
          </Field>

          <Field label="Bransch" name="category" required error={err("category")}>
            <Select
              name="category"
              defaultValue={defaults.category}
              options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
            />
          </Field>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Tema" name="themeKey" required error={err("themeKey")}>
              <Select
                name="themeKey"
                defaultValue={defaults.themeKey}
                options={THEME_KEYS.map((t) => ({ value: t, label: THEME_LABELS[t] }))}
              />
            </Field>
            <Field label="Palett" name="paletteVariant" error={err("paletteVariant")}>
              <Select
                name="paletteVariant"
                defaultValue={String(defaults.paletteVariant)}
                options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="Rådata är kundens egna ord och skrivs aldrig över. Beskrivningen är den putsade texten som publiceras.">
          Texter
        </SectionTitle>
        <div className="space-y-4">
          <Field label="Kundens originaltext (rådata)" name="rawDescription" error={err("rawDescription")}>
            <TextArea name="rawDescription" defaultValue={defaults.rawDescription} rows={3} maxLength={2000} />
          </Field>
          <Field
            label="Beskrivning (publiceras)"
            name="description"
            error={err("description")}
            hint="Minst 80 tecken krävs för publicering — tunt innehåll rankar inte."
          >
            <TextArea name="description" defaultValue={defaults.description} rows={5} maxLength={2000} />
          </Field>
          <Field label="Tjänster" name="services" error={err("servicesJson")} hint="Minst två krävs för publicering.">
            <ServicesEditor defaultValue={defaults.services} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="WhatsApp-numret är hela produktens konverteringspunkt. Skriv 0981 123 456 eller +595 981 123 456.">
          Kontakt
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp" name="whatsappPhone" required error={err("whatsappPhone")}>
            <TextInput name="whatsappPhone" defaultValue={defaults.whatsappPhone} required placeholder="0981 123 456" />
          </Field>
          <Field label="Andra telefon" name="secondaryPhone" error={err("secondaryPhone")}>
            <TextInput name="secondaryPhone" defaultValue={defaults.secondaryPhone} placeholder="021 234 567" />
          </Field>
          <Field label="Adress" name="address" error={err("address")}>
            <TextInput name="address" defaultValue={defaults.address} maxLength={200} />
          </Field>
          <Field label="Zon / barrio" name="zone" error={err("zone")}>
            <TextInput name="zone" defaultValue={defaults.zone} maxLength={80} />
          </Field>
          <Field label="Stad" name="city" required error={err("city")}>
            <TextInput name="city" defaultValue={defaults.city} maxLength={80} required />
          </Field>
          <Field label="Google Maps-länk" name="mapsUrl" error={err("mapsUrl")}>
            <TextInput name="mapsUrl" defaultValue={defaults.mapsUrl} placeholder="https://maps.app.goo.gl/…" />
          </Field>
          <Field label="Latitud" name="lat" error={err("lat")} hint="Valfritt — ger geo i LocalBusiness-schemat.">
            <TextInput name="lat" defaultValue={defaults.lat} placeholder="-25.2867" />
          </Field>
          <Field label="Longitud" name="lng" error={err("lng")}>
            <TextInput name="lng" defaultValue={defaults.lng} placeholder="-57.3333" />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="Driver 'Abierto ahora' på sajten och openingHoursSpecification i schemat.">
          Öppettider
        </SectionTitle>
        <HoursEditor defaultValue={defaults.hours} />
      </Card>

      <Card>
        <SectionTitle>Sociala länkar</SectionTitle>
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
        <SectionTitle hint="Lämnas tomma genereras de från namn, bransch och zon.">SEO</SectionTitle>
        <div className="space-y-4">
          <Field label="SEO-titel" name="seoTitle" error={err("seoTitle")} hint="Max 70 tecken.">
            <TextInput name="seoTitle" defaultValue={defaults.seoTitle} maxLength={70} />
          </Field>
          <Field
            label="SEO-beskrivning"
            name="seoDescription"
            error={err("seoDescription")}
            hint="Max 160 tecken. Krävs för publicering."
          >
            <TextArea name="seoDescription" defaultValue={defaults.seoDescription} rows={2} maxLength={160} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>Internt</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="RUC" name="ruc" error={err("ruc")} hint="Valfritt, för fakturan till kunden.">
            <TextInput name="ruc" defaultValue={defaults.ruc} maxLength={20} />
          </Field>
          <Field label="Anteckningar (syns bara för dig)" name="adminNotes" error={err("adminNotes")}>
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
