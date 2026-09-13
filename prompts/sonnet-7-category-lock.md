# Phase S7 — Category-locked presentation + price list. Opus session (one-off
# bake-off, plan §11.0; every other lane 2 phase is Sonnet). Lane 2, parallel
# with S1, S2, S5.

Read ONLY: this file, `plan.md` (phase table, §1 esp. 1.11–1.13, §4, §6.5,
§9, §11.0), `docs/log/O1.md`, `src/lib/business.ts`, `src/themes/registry.ts`,
`src/themes/palettes.ts`, `src/components/admin/theme-picker.tsx`,
`src/components/admin/business-form.tsx`,
`src/app/admin/(dashboard)/sitios/actions.ts`,
`src/app/admin/(dashboard)/alta/actions.ts`, `src/app/alta/[token]/actions.ts`,
`src/lib/billing.ts` (the `PLAN_SUGGESTED_PRICE_GS` block only),
`tests/smoke/_lib.mjs` and one existing `tests/smoke/*.mjs` for the pattern.
Execute under plan §4.

Owns: `src/lib/presentation.ts`, `tests/unit/presentation.test.ts`,
`tests/smoke/presentation.mjs`, `src/components/admin/theme-picker.tsx`
(replace with the read-only block), `docs/log/S7.md`.
Scoped edits (only the named part of each file): the theme/palette block in
`src/components/admin/business-form.tsx`; the theme/variant derivation in
`src/app/admin/(dashboard)/sitios/actions.ts`,
`src/app/admin/(dashboard)/alta/actions.ts` and
`src/app/alta/[token]/actions.ts`; the `themeKey`/`paletteVariant` fields of
the business zod schema in `src/lib/business.ts`; the values of
`PLAN_SUGGESTED_PRICE_GS` in `src/lib/billing.ts` (300 000 / 600 000 / 900 000).

Hard limits (§4.7): no schema change (the two columns stay), no auth, no env,
no edits to `THEME_LABELS`, `CATEGORIES`, `registry.ts`, `palettes.ts`,
`render-site.tsx` or any theme directory. `salud` may not be built yet when
you run: the mapping still names it; `isThemeBuilt` drives the existing
"ej byggt än" warning and the renderer's fallback until S2 merges.

Budget: one session, ≤ 75 min. When the exit criteria pass, open the PR that turn.

Phase rules:
- Branch `phase/S7` off latest `main`. WIP commit every 30 min.
- `presentationFor(category)` is a pure function over the literal table in
  plan §1.11; the unit test compares against that table literally and
  asserts every `CATEGORIES` value maps to a `THEME_KEYS` value with a
  variant in 1–4.
- Every write path sets both columns from the function and ignores any
  submitted `themeKey`/`paletteVariant`. After this phase
  `grep -rn 'formData.get("themeKey")' src` is empty.
- Admin block: read-only, Swedish, shows the derived theme and a palette
  swatch for the currently selected category, updates client-side when the
  category select changes, one line "Tema och palett följer branschen
  (plan §1.11)". No hidden inputs.
- Smoke against local MySQL 8 (recipe in `tests/smoke/README.md`): create a
  `taller` business in admin → stored `servicios`/1 and the public page root
  carries the servicios class with the orange accent; change the category to
  `comercio` → re-derived to `comercio`/1.
- Re-runnable; minor issues → `docs/log/S7.md`; stop only per §4.4.

Exit: unit + smoke green; admin `nuevo` and `[id]` show the derived
presentation and no picker; the grep above is empty; pre-push green; PR
merged; log + §9 line.

## After this phase
Follow `prompts/_handoff.md`. Lane 2: spawn nothing. Do not touch
`phase/S7-astra` (Anton's parallel Astra run of this same file); the
bake-off judgement happens in Anton's own session, not here.
