# Decisions needed from Anton

Build sessions append a dated question here and end (plan §4.4). The watcher
notifies Anton. Answer inline under the question, commit to `main`; the next
run of the phase reads it.

## 2026-09-13 — Price numbers (planning session, plan §1.13 / PLAN.md §1.7)

The pricing *structure* is decided and written into `docs/PLAN.md` §1.7: two
sold tiers, same price for every category, no à-la-carte modules, mid-year
upgrade = flat difference with the same expiry. What needs your explicit yes
is the money, because O2 prints it on the landing page and S7 writes it into
`PLAN_SUGGESTED_PRICE_GS` (the admin's default when you create a subscription;
your free `priceGs` field stays).

Proposed: Básico ₲ 400.000/year · Plus ₲ 600.000/year · Pro reserved,
₲ 900.000 suggested for fase 3 · upgrade Básico→Plus ₲ 200.000 flat.

Answer with the three numbers you want (or "ok"). If unanswered when O2 opens
its PR, O2 uses the proposed numbers and S7 syncs the same; changing them later
is one cheap round-3 ticket, not a rewrite.

**Answer:** _(pending)_
