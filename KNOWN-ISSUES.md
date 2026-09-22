# Known issues

Still-open items across `docs/log/*.md`, one line each with the phase they
came from. Resolved items are not copied here — see the phase log for full
context. Compiled by the S6 link pass (`docs/log/S6.md`); ticket source for
round 3 (plan.md §11) together with plan.md §10 (Backlog). Re-audited against
the code on 2026-09-22 (batch 3, `docs/log/R3-3.md`).

- **`comercio` renders both `<SiteProducts>` (catálogo) and `<SiteMenu>`
  ("Nuestra lista")** when a business has both `menu` and `products` on. No
  conflict, but duplicates the same information. Needs an Anton decision:
  hide `menu` in `comercio` once `products` is on, or leave both
  (`docs/decisions-needed.md`, open since 2026-09-14). (S1)
- **Products has no view event in the analytics enum** (`menu_view` exists,
  no `products_view`). Needs a migration (enum on `analytics_events`). The
  radar's "menu or products" term reads `business_modules`, by design. (S1, S5)
- **Landing page still loads `globals.css` (Tailwind)** via the root layout
  even though it uses zero utilities — breaking it into its own route group
  would force a second `<html>` layout for one route. Backlog. (O2)
- **An applied AI-polish proposal can go stale** if services change after it
  was generated — "Aplicar" would then write back the old service list. The
  diff's "Nu" column shows this before you check a box, so it's visible, not
  silent. Re-run the polish after a service edit. By design. (O3)
- **`listLeads()` has the same 300-row cap as `listBusinesses`**, no
  pagination. Not a problem at current customer volume. (S5)
