"use client";

import { useState } from "react";
import { THEME_KEYS, THEME_LABELS } from "@/lib/business";
import { PALETTES, paletteFor } from "@/themes/palettes";

/**
 * Tema- och palettväljare med förhandsvisning. Superadmin väljer variant
 * manuellt vid publicering — det är den enda spärren mot att två grannar i
 * samma bransch får identiskt utseende (docs/PLAN.md §1.5), så valet måste
 * gå att se, inte bara läsa som siffran 1–4.
 *
 * Svenska: superadmin-UI.
 */
export function ThemePicker({
  defaultThemeKey,
  defaultVariant,
  themeError,
  variantError,
}: {
  defaultThemeKey: string;
  defaultVariant: number;
  themeError?: string;
  variantError?: string;
}) {
  const [themeKey, setThemeKey] = useState(defaultThemeKey);
  const [variant, setVariant] = useState(defaultVariant);
  const built = themeKey in PALETTES;

  return (
    <div className="sm:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="themeKey" className="mb-1.5 block text-sm text-admin-muted">
            Tema <span className="text-admin-danger">*</span>
          </label>
          <select
            id="themeKey"
            name="themeKey"
            value={themeKey}
            onChange={(e) => setThemeKey(e.target.value)}
            className="w-full rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2 text-sm text-admin-text outline-none focus:border-admin-accent"
          >
            {THEME_KEYS.map((t) => (
              <option key={t} value={t}>
                {THEME_LABELS[t]}
                {t in PALETTES ? "" : " (ej byggt än)"}
              </option>
            ))}
          </select>
          {themeError ? <p className="mt-1 text-xs text-admin-danger">{themeError}</p> : null}
          {!built ? (
            <p className="mt-1 text-xs text-admin-warn">
              Temat är inte byggt än — sajten renderas med <code>servicios</code> tills det finns.
            </p>
          ) : null}
        </div>

        <div>
          <span className="mb-1.5 block text-sm text-admin-muted">Palettvariant</span>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => {
              const p = paletteFor(themeKey, n);
              const active = variant === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setVariant(n)}
                  aria-pressed={active}
                  title={`Variant ${n} — accent ${p.accent} (hue ${p.hue}°)`}
                  className={`flex-1 rounded-lg border p-1.5 transition-colors ${
                    active ? "border-admin-accent" : "border-admin-line hover:border-admin-muted"
                  }`}
                >
                  <span
                    className="flex h-9 items-center justify-center rounded-md text-[11px] font-semibold"
                    style={{ background: p.base, color: p.ink, border: `1px solid ${p.hairline}` }}
                  >
                    <span
                      className="mr-1.5 inline-block h-3.5 w-3.5 rounded-full"
                      style={{ background: p.accent }}
                    />
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="paletteVariant" value={variant} />
          {variantError ? <p className="mt-1 text-xs text-admin-danger">{variantError}</p> : null}
          <p className="mt-1 text-xs text-admin-muted">
            Accent {paletteFor(themeKey, variant).accent} · hue {paletteFor(themeKey, variant).hue}°.
            Spara och öppna förhandsvisningen för att se hela sajten.
          </p>
        </div>
      </div>
    </div>
  );
}
