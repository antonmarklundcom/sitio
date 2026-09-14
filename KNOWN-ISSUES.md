# Known issues

Still-open items across `docs/log/*.md`, one line each with the phase they
came from. Resolved items are not copied here — see the phase log for full
context. Compiled by the S6 link pass (`docs/log/S6.md`); ticket source for
round 3 (plan.md §11) together with plan.md §10 (Backlog).

- **Smoke suite login budget is exactly at the cap.** 5 phase suites × 1
  admin login each = 5, the rate limit's ceiling (`login:email:*`, 5/15 min,
  in-process). A 6th suite that logs in makes `npm run smoke` fail on its
  last suite with nothing actually broken. The fix (a shared logged-in
  `storageState` in `tests/smoke/_lib.mjs`) is O1's file, not link-pass
  scope. (O3, S6)
- **`comercio` renders both `<SiteProducts>` (catálogo) and `<SiteMenu>`
  ("Nuestra lista")** when a business has both `menu` and `products` on. No
  conflict, but duplicates the same information. Needs an Anton decision:
  hide `menu` in `comercio` once `products` is on, or leave both. (S1)
- **Product cards have no image.** `media.kind = "product"` is out of scope
  this round, same as menu items — text- and price-list only. Tracked in
  plan.md §10 backlog. (S1)
- **`BusinessFormDefaults` still carries `themeKey`/`paletteVariant`.** The
  form no longer reads them (S7 removed the picker), but
  `sitios/nuevo/page.tsx` and `sitios/[id]/page.tsx` still pass them as
  props — those files are outside every lane-2 Owns block. Dead props, not a
  behavior bug. (S7)
- **`scripts/seed-dev.ts` sets palette variants 1/2/3** for its three demo
  rows; the §1.11 table gives `taller`/`servicios`/`gastronomia` variant
  2/1/1. Cosmetic — self-corrects the first time each row is saved in admin.
  Seed data is explicitly out of scope for S7/S6. (S7)
- **No `og:image` on the landing page.** No image budget this round; sharing
  cards are text-only (`og:type`, `og:locale`, `twitter:card summary` are
  set). (O2)
- **Landing page still loads `globals.css` (Tailwind)** via the root layout
  even though it uses zero utilities — breaking it into its own route group
  would force a second `<html>` layout for one route. Backlog. (O2)
- **`public/file.svg`, `globe.svg`, `window.svg`** are unused Next.js
  template leftovers. Outside every lane-2 Owns block (`public/**` isn't
  owned by any phase this round). (O2)
- **`npm audit` (with dev deps) has 4 moderate `esbuild` findings** via
  `drizzle-kit → @esbuild-kit/*`. Dev-only; the exit criterion was
  `--omit=dev`, which is clean. Needs a `drizzle-kit` major to clear. (O1)
- **Products has no view event in the analytics enum** (`menu_view` exists,
  no `products_view`). No migrations this round (plan §1.1), so the upsell
  radar's "menu or products" score term reads `business_modules`, not actual
  usage — by design, not a bug, but the gap stays until a migration round.
  (S1, S5)
- **An applied AI-polish proposal can go stale** if services change after it
  was generated — "Aplicar" would then write back the old service list. The
  diff's "Nu" column shows this before you check a box, so it's visible, not
  silent. Re-run the polish after a service edit. (O3)
- **`listLeads()` has the same 300-row cap as `listBusinesses`**, no
  pagination. Not a problem at current customer volume. (S5)
- **`scripts/theme-preview.tsx`'s shared `DEMO_MENU` placeholder** (dishes,
  not consultations/services) reads oddly in the `salud` QA screenshot.
  Cosmetic, shared fixture outside every lane-2 Owns block. (S2)
