# Phase S7 — Category-locked presentation + price list. Opus session. Lane 2,
last slot, no dependency on S1/S2/S5 beyond O1.

Bake-off (plan §11.0) skipped per Anton, 2026-09-14 — build this directly on
Opus, no parallel Astra dispatch, no comparison step. Everything else in this
file stands.

Read ONLY: this file, `plan.md` (phase table, §1.11–§1.13, §4, §6.5, §9),
`docs/log/O1.md`, `docs/PLAN.md` §1.5 (already rewritten to match §1.11 — read
for the mapping table, do not edit it again), `src/lib/business.ts`
(`CATEGORIES`, `THEME_KEYS`, `THEME_LABELS`, the business zod schema),
`src/themes/registry.ts` (`BUILT_THEMES`, `isThemeBuilt`),
`src/lib/billing.ts` (current `PLAN_SUGGESTED_PRICE_GS`/`PLAN_LABELS`),
`src/components/admin/theme-picker.tsx`, `src/components/admin/business-form.tsx`,
`src/app/admin/(dashboard)/sitios/actions.ts`,
`src/app/admin/(dashboard)/alta/actions.ts`, `src/app/alta/[token]/actions.ts`.
Execute under plan §4.

Owns: `src/lib/presentation.ts`, `tests/unit/presentation.test.ts`,
`src/components/admin/theme-picker.tsx` (replace), `src/components/admin/business-form.tsx`
(theme/palette block only), `src/app/admin/(dashboard)/sitios/actions.ts`
(theme/variant derivation only), `src/app/admin/(dashboard)/alta/actions.ts`
(theme/variant derivation only), `src/app/alta/[token]/actions.ts`
(theme/variant derivation only), the business zod schema in `src/lib/business.ts`
(only the `themeKey`/`paletteVariant` fields — see rule below), `PLAN_SUGGESTED_PRICE_GS`
+ `PLAN_LABELS` values in `src/lib/billing.ts`, `tests/smoke/presentation.mjs`,
`docs/log/S7.md`.

`src/lib/business.ts` is not in the phase table's Owns column, but plan §6.5
point 2 requires it ("the zod schema in business.ts stops requiring the two
fields from the form"): make `themeKey`/`paletteVariant` optional in the zod
object (or drop them and have callers stop passing them) — nothing else in
that file changes. Log this scope note in `docs/log/S7.md` "Decisions", same
as S2 logged its `theme-preview.tsx` addition.

Hard limits (§4.7): no schema change — `themeKey`/`paletteVariant` stay as
database columns, only how they're written changes. No auth/session/middleware/
env changes. No edits to `scripts/theme-preview.tsx`, the `themeKey` enum, or
any theme directory. Not in scope: trimming `ThemePalettes` tuples, seed data
(`seed-dev.ts` already matches the table).

Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that
turn.

Phase rules:
1. `src/lib/presentation.ts`: `PRESENTATION_BY_CATEGORY` typed against
   `CATEGORIES`/`THEME_KEYS`, built literally from the table in plan §1.11 /
   `docs/PLAN.md` §1.5 (`servicios`→servicios/2, `taller`→servicios/1,
   `comercio`→comercio/1, `otro`→comercio/2, `gastronomia`→gastronomia/1,
   `salud`→salud/1, `belleza`→salud/2). `presentationFor(category)` returns
   `{ themeKey, paletteVariant }`. `presentationLabel(category)` returns a
   Swedish admin string, e.g. `"servicios · variant 2 (cyan)"` — accent name
   comes from `docs/PALETTE-REGISTRY.md`/`palettes.ts`. Pure: no `db` or React
   imports.
2. Every write path sets both columns from `presentationFor(category)` and
   ignores any submitted `themeKey`/`paletteVariant`: `sitios/actions.ts`
   (create and update), `alta/actions.ts` (replaces the inline
   `category === "otro" ? "servicios" : category` expression), and
   `alta/[token]/actions.ts` when the customer's submitted category differs
   from the prefilled one.
3. Admin: replace `theme-picker.tsx` with a read-only block — derived theme
   name + a palette swatch (the accent color) for the currently selected
   category, client-side, updates live as the `category` select changes
   (before save), plus the line "Tema och palett följer branschen (plan
   §1.11)". No hidden form inputs for theme/variant. `business-form.tsx`
   keeps its layout; only the picker block changes. Keep the "ej byggt än"
   warning, driven by `isThemeBuilt` — irrelevant now that all four are built,
   but do not delete the mechanism, just let it render nothing.
4. `src/lib/billing.ts`: `PLAN_SUGGESTED_PRICE_GS` → `basico: 300_000, plus:
   600_000, pro: 900_000` (currently 300k/450k/600k — fix all three).
   `PLAN_LABELS` unchanged.
5. Tests: `tests/unit/presentation.test.ts` — every `CATEGORIES` value maps to
   a key in `THEME_KEYS`, every variant is 1–4, and the full mapping equals
   the §1.11 table literally (object equality against a literal, not a loop
   that could drift silently). `tests/smoke/presentation.mjs` — create a
   business as `taller` via admin, assert stored `themeKey`/`paletteVariant`
   are `servicios`/1 and the public page root carries `.t-servicios` with the
   orange (`#FF8A1F`) accent; change the category to `comercio`, assert it
   re-derives to `comercio`/1.
6. Re-runnable; minor issues → `docs/log/S7.md`; stop only per §4.4.

Exit: `npm test` green including the new presentation tests; `npm run smoke`
includes `presentation.mjs` and is green; admin `nuevo` and `[id]` pages show
the derived presentation, no picker; `grep -rn 'formData.get("themeKey")' src`
is empty; pre-push green; PR merged; log + §9 line.

## After this phase
Follow `prompts/_handoff.md`. This is the last lane-2 phase to complete before
S6: once S1, S2, S5 and S7 are all merged, spawn S6
(`prompts/sonnet-6-link-pass.md`, Sonnet) if the watcher Routine hasn't
already (`list_triggers` for "sitio watcher"; if it exists, let it spawn S6 on
its next firing instead of spawning a duplicate). If the watcher was already
deleted or never existed, spawn S6 yourself.
