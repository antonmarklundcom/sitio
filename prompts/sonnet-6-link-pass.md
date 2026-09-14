# Phase S6 — Link pass. Sonnet session. Sequential, after S1, S2, S5 and S7
are merged.

Read ONLY: this file, `plan.md` (phase table, §1, §4, §6.4, §7, §9, §10),
every `docs/log/*.md`, `docs/decisions-needed.md`, `README.md` sections
"Teman", "Moduler", "Röktest", "CI och git-hooks". Execute under plan §4.

Owns (cross-cutting, this phase only): the `<SiteProducts>` call in
`src/themes/{servicios,gastronomia,salud}/*-theme.tsx` (three — `comercio`
already has its own products override from S1; there are four themes total,
not six — `belleza`/`taller` are categories, not theme directories, §1.12),
`src/themes/registry.ts`, `src/themes/palettes.ts`, `src/app/[slug]/layout.tsx`,
`docs/PALETTE-REGISTRY.md` (consistency only), `package.json` `smoke` script,
`README.md`, `docs/HANDOVER.md` (retire), `docs/PLAN.md` §3 tables (mark
built), `KNOWN-ISSUES.md`, `plan.md` §9/§10, `docs/log/S6.md`.

Budget: one session, ≤ 60 min. When the exit criteria pass, open the PR that turn.

Phase rules:
- Branch `phase/S6` off latest `main`. WIP commit every 30 min.
- Steps exactly as plan §6.4, in order. No new features; a missing feature is
  a §10 line.
- Full QA gate for all four themes once; full `npm run smoke` once against
  MySQL 8; record both counts in the log.
- `KNOWN-ISSUES.md`: one line per still-open item, with the phase it came
  from. Do not copy resolved items.
- Re-runnable; stop only per §4.4.

Exit: products section renders in all four themes when the module is on
(smoke or screenshot); QA gate green ×4; smoke green end to end;
HANDOVER retired; README current; KNOWN-ISSUES.md exists; pre-push green;
PR merged; log + §9 line.

## After this phase
Delete the watcher Routine (`list_triggers` → `delete_trigger` on "sitio
watcher"), then STOP with the closing report: what shipped (one line per
phase with PR link), what is open (KNOWN-ISSUES), and the plan §7 items still
needed from Anton. Spawn nothing.
