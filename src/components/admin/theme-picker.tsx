"use client";

import { useEffect, useState } from "react";
import { presentationFor, presentationLabel } from "@/lib/presentation";
import { PALETTES, paletteFor } from "@/themes/palettes";

/**
 * Härledd presentation, läsbar men inte valbar. Branschen bestämmer tema och
 * palett (plan §1.11) — det finns inget val kvar att göra här, bara ett
 * resultat att se innan man sparar.
 *
 * Blocket lyssnar på bransch-selecten i samma formulär i stället för att äga
 * den: `business-form.tsx` behåller sin layout och sitt okontrollerade
 * formulär, och raden uppdateras ändå direkt när man byter bransch.
 *
 * Svenska: superadmin-UI.
 */
export function PresentationBlock({
  defaultCategory,
  categorySelectId = "category",
}: {
  defaultCategory: string;
  /** id på select-elementet som styr branschen. */
  categorySelectId?: string;
}) {
  const [category, setCategory] = useState(defaultCategory);

  useEffect(() => {
    const el = document.getElementById(categorySelectId) as HTMLSelectElement | null;
    if (!el) return;
    setCategory(el.value);
    const onChange = () => setCategory(el.value);
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, [categorySelectId]);

  const { themeKey, paletteVariant } = presentationFor(category);
  const palette = paletteFor(themeKey, paletteVariant);
  const built = Object.prototype.hasOwnProperty.call(PALETTES, themeKey); // Avoid importing registry theme components into the client bundle.

  return (
    <div className="sm:col-span-2">
      <span className="mb-1.5 block text-sm text-admin-muted">Presentación</span>
      <div className="flex items-center gap-3 rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2.5">
        <span
          aria-hidden
          className="inline-block h-6 w-6 shrink-0 rounded-md"
          style={{ background: palette.accent, border: `1px solid ${palette.hairline}` }}
        />
        <span className="text-sm text-admin-text">{presentationLabel(category)}</span>
        <span className="text-xs text-admin-muted">
          acento {palette.accent} · tono {palette.hue}°
        </span>
      </div>
      {/* Kvar som mekanism: faller ett tema bort ur registret ska raden säga
          det i stället för att sajten tyst renderas med servicios. */}
      {!built ? (
        <p className="mt-1 text-xs text-admin-warn">
          El tema todavía no está; el sitio se muestra con <code>servicios</code> hasta que esté disponible.
        </p>
      ) : null}
      <p className="mt-1 text-xs text-admin-muted">El tema y la paleta siguen al rubro (plan §1.11).</p>
    </div>
  );
}
