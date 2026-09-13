# Phase S5 — Upsell radar (PR-16). Sonnet session. Lane 2, parallel with S1, S2, S7.

Read ONLY: this file, `plan.md` (phase table, §1, §4, §6.3, §9),
`docs/log/O1.md`, `docs/PLAN.md` §1.10, `src/db/queries.ts` (listBusinesses
and the correlated-subquery warning), `src/db/analytics-queries.ts`,
`src/lib/billing.ts` (`renewalMessage`), `src/app/api/cron/rollup/route.ts`,
`src/app/admin/(dashboard)/layout.tsx`, `src/app/admin/(dashboard)/pagos/page.tsx`
(as the pattern for an admin work view). Execute under plan §4.

Owns: `src/lib/radar.ts`, `src/db/lead-queries.ts`,
`src/app/admin/(dashboard)/leads/**`, `src/components/admin/leads-*.tsx`,
`tests/unit/radar.test.ts`, `tests/smoke/radar.mjs`, `docs/log/S5.md`.
Append-only: one `NAV` entry in `src/app/admin/(dashboard)/layout.tsx`, one
`runRadar()` call in `src/app/api/cron/rollup/route.ts` after the lifecycle step.

Hard limits (§4.7): no schema (the columns exist), no env (thresholds exist),
no analytics-ingest changes, no reading from `analytics_events` (rollup table only).

Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn.

Phase rules:
- Branch `phase/S5` off latest `main`. WIP commit every 30 min.
- Score formula and hot-lead rule exactly as plan §6.3. Pure function first,
  unit-tested at the boundaries, then the DB pass.
- `runRadar()` updates all published businesses in one pass; a business that
  is not published keeps its last score. Log one `radar_run` activity row
  with counts, not one per business.
- `/admin/leads` in Swedish (superadmin UI). Stage buttons and notes are
  server actions behind `requireRole("superadmin")`, logged as
  `lead_stage_changed` / `lead_note_saved`.
- Pitch wa.me link: the 30-day numbers, omitted when zero (same honesty rule
  as `renewalMessage`).
- Smoke against local MySQL 8: insert `analytics_daily` rows for two seeded
  businesses, call the cron route with the bearer, assert order and flag.
- Re-runnable; minor issues → `docs/log/S5.md`; stop only per §4.4.

Exit: unit + smoke green; `/admin/leads` renders sorted; the existing
hot-lead column on `/admin` reflects the flag after one cron call; pre-push
green; PR merged; log + §9 line.

## After this phase
Follow `prompts/_handoff.md`. Lane 2: spawn nothing.
