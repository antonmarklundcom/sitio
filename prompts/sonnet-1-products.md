# Phase S1 — Products module (PR-14). Sonnet session. Lane 2, parallel with S2–S5.

Read ONLY: this file, `plan.md` (phase table, §1, §4, §6.1, §9),
`docs/log/O1.md`, `docs/HANDOVER.md` section "Nästa session: PR-14" (file map
only), and the menu chain: `src/lib/menu-form.ts`, `src/db/menu-queries.ts`,
`src/app/mi-sitio/menu-actions.ts`, `src/components/mi-sitio/owner-menu.tsx`,
`src/components/site/menu-section.tsx`, `src/db/site-queries.ts`,
`src/app/mi-sitio/page.tsx`. Execute under plan §4.

Owns: `src/lib/product-form.ts`, `src/db/product-queries.ts`,
`src/app/mi-sitio/product-actions.ts`, `src/components/mi-sitio/owner-products.tsx`,
`src/components/site/products-section.tsx`, `src/themes/comercio/**`,
`tests/unit/product-form.test.ts`, `tests/smoke/products.mjs`, `docs/log/S1.md`.
Append-only: `src/themes/theme.css` (`/* == S1 == */` block at the end),
`src/lib/modules.ts` (remove `plannedIn` on `products`), `src/db/site-queries.ts`
(load products when the module is on, add `products` to `SiteData`),
`src/themes/types.ts` (add `products` to `ThemeProps`, default-safe),
`src/components/site/render-site.tsx` (pass it through), `src/app/mi-sitio/page.tsx`
(mount the editor).

Hard limits (§4.7): no schema, auth, env, billing, analytics-ingest changes;
no edits to other themes (S6 wires `<SiteProducts>` into them); no edits to
`scripts/smoke-e2e.mjs`.

Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn.

Phase rules:
- Branch `phase/S1` off latest `main`. WIP commit every 30 min.
- Copy the menu chain file by file; keep the server-side module check in the
  action context (an owner with a stale tab must be refused when the module
  is off). Cap 60 products. Empty price = "A consultar". `isVisible` hides on
  the public site, keeps in the panel. Move up/down buttons, no drag.
- Products render in every theme through `<SiteProducts>` when
  `modules.has("products")` — but in THIS phase you add the call only in
  `comercio`. Other themes: S6.
- Product images out of scope; say so in the log.
- Smoke against local MySQL 8 (`tests/smoke/README.md`). Restart the server
  between runs if the login rate limit bites.
- Re-runnable; minor issues → `docs/log/S1.md`; stop only per §4.4.

Exit: unit test for the form parser green; `tests/smoke/products.mjs` covers
off → on, create two, "A consultar", hidden product absent publicly, off hides
without deleting; comercio QA gate once (`npm run theme:preview && npm run
theme:shots comercio`) with no overflow; admin no longer says "ej byggt än"
for Produkter; pre-push green; PR merged; log + §9 line.

## After this phase
Follow `prompts/_handoff.md`. Lane 2: spawn nothing.
