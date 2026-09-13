# Phase S2 — Theme `salud` (serves categories `salud` and `belleza`). Sonnet session. Lane 2, parallel with S1, S5, S7.

Read ONLY: this file, `plan.md` (phase table, §1 esp. 1.7, §4, §6.2, §9),
`docs/log/O1.md`, `docs/PALETTE-REGISTRY.md`, `src/themes/types.ts`,
`src/themes/registry.ts`, `src/themes/palettes.ts`, `src/themes/theme.css`,
`src/themes/servicios/servicios-theme.tsx` and `src/themes/comercio/comercio-theme.tsx`
(props contract and primitives), `scripts/theme-preview.tsx` (how the QA gate
picks up a theme). Execute under plan §4.

Owns: `src/themes/salud/**`, `docs/log/S2.md`.
Append-only: one entry in `src/themes/registry.ts`, one `ThemePalettes` const +
`PALETTES` entry in `src/themes/palettes.ts`, one CSS import in
`src/app/[slug]/layout.tsx`, one section in `docs/PALETTE-REGISTRY.md`,
a `/* == S2 == */` block at the end of `src/themes/theme.css` only if a shared
primitive is genuinely missing (prefer `salud.css`).

Hard limits (§4.7): no schema, auth, env changes; no edits to other themes'
directories; no products section (S6 adds it); do not touch `THEME_LABELS`.

Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn.

Phase rules:
- Branch `phase/S2` off latest `main`. WIP commit every 30 min.
- Design direction for `salud` is fixed in plan §6.2 (calm, appointment-first,
  photo block after the hero, restraint rule). Different section map from
  every existing theme (read their header comments; they list theirs).
- Palette order matters: v1 teal (locked to `salud`), v2 rose (locked to
  `belleza`), v3 navy, v4 sage. All four built and QA'd; two are selected.
- Load skill `web-design-system` if available for the pattern names and the
  contrast rule; otherwise follow §6.2 and the registry table format.
- Four palettes, hues ≥ 40° apart within the theme, text/base ≥ 4.5:1;
  compute the ratios and put the table in the registry section.
- Menu via `<SiteMenu>` when `modules.has("menu")`; gallery shows all photos
  when `modules.has("gallery")`, else the first 3–6. `data-ev` on every CTA
  like the other themes. `.t-light` on the root if the theme is light.
- QA gate once, after the last CSS change: `npm run theme:preview && npm run
  theme:shots salud`; fix overflow at 360/768/1280 for all four variants.
- On merge conflicts in the append-only files: main wins, re-add your line.
- Re-runnable; minor issues → `docs/log/S2.md`; stop only per §4.4.

Exit: `isThemeBuilt("salud")` true; QA gate green for v1–v4; registry section
with hue + contrast table and v1/v2 marked as the locked variants; a unit
test asserting `BUILT_THEMES` includes `salud`; pre-push green; PR merged;
log + §9 line. Do not touch the admin picker (S7 replaces it).

## After this phase
Follow `prompts/_handoff.md`. Lane 2: spawn nothing.
