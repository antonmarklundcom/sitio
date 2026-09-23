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
- **Landing page still loads `globals.css` (Tailwind)** via the root layout
  even though it uses zero utilities — breaking it into its own route group
  would force a second `<html>` layout for one route. Backlog. (O2)
- **An applied AI-polish proposal can go stale** if services change after it
  was generated — "Aplicar" would then write back the old service list. The
  diff's "Nu" column shows this before you check a box, so it's visible, not
  silent. Re-run the polish after a service edit. By design. (O3)
- **`listLeads()` has the same 300-row cap as `listBusinesses`**, no
  pagination. Not a problem at current customer volume. (S5)
- **CSP `script-src` still has `'unsafe-inline'`.** Every App Router page
  carries ~20 inline `self.__next_f.push(…)` scripts with its RSC payload;
  without `'unsafe-inline'` each response needs a nonce, and nonces force
  dynamic rendering — the customer sites are ISR by design. All other
  directives are locked to self (R3-24). Revisit if Next gets hash-based CSP
  for static output, or if the sites ever leave ISR. (R3-24)
- **Rate limits still key on the first `x-forwarded-for` entry by default**
  (`CLIENT_IP_SOURCE=xff-first`). If Hostinger's proxy appends instead of
  replacing the header, a bot can rotate it and skip the 5/h signup limit.
  One env var fixes it once `/admin/diagnostico` shows which source carries
  the real IP (R3-27, batch 4).
