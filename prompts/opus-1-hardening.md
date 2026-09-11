# Phase O1 — Hardening and test harness. Opus session. Lane 1.

Read ONLY: this file, `plan.md` (phase table, §1, §4, §5.1, §9),
`docs/REPORT-2026-09.md` §2 F3/F4/F9. Do not read `docs/PLAN.md` end to end or
`docs/HANDOVER.md` (except the MySQL recipe in "Nästa session" step 5).
Execute under plan §4. Build nothing outside §5.1.

Owns: `package.json`, `package-lock.json`, `vitest.config.ts`, `tests/unit/**`,
`tests/smoke/**`, `scripts/smoke-e2e.mjs`, `next.config.ts`, `.husky/pre-push`,
`.gitignore`, `src/app/api/cron/rollup/route.ts`, `README.md` (only the
sections that describe the checks and the smoke run), `docs/log/O1.md`.
You may add `export` to a pure function in `src/lib/*` to make it testable
(`dayRange` in `rollup.ts`); no behaviour changes in `src/`.

Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn.

Phase rules:
- Branch `phase/O1` off latest `main`. WIP commit every 30 min.
- Order: dependency bump first (so the lockfile settles before anything else
  touches `package.json`), then vitest, then hook, then security, then the
  smoke split, then the one full smoke run against a local MySQL 8 (recipe:
  plan §4.16 → copy into `tests/smoke/README.md`).
- Tests are for pure logic only. Do not mock the database; anything that
  needs `db` is smoke territory. `vi.mock("server-only", () => ({}))` in
  `tests/unit/setup.ts` handles the `import "server-only"` guards.
- Do not "improve" `src/` while you are in there. Findings go to §10.
- `npm audit fix` is allowed; `npm audit fix --force` is not. If a clean
  audit needs a Next minor, take it, run smoke, and note it in the log.
- Re-runnable; minor issues → `docs/log/O1.md`; stop only per §4.4.

Exit (all verified, not assumed):
- `npm audit --omit=dev` → 0 vulnerabilities.
- `npm test` → ≥ 60 passing assertions across ≥ 9 files.
- `.husky/pre-push` runs `typecheck && lint && test && build`.
- `GET /api/cron/rollup?key=<secret>` → 403; bearer header → 200.
- `curl -I /` shows the four security headers from §5.1.
- `.gitignore` no longer lists the migration file.
- `npm run smoke` → 75/75 against MySQL 8 with the helpers in `tests/smoke/_lib.mjs`.
- PR merged, `docs/log/O1.md` written, §9 line added.

## After this phase
Follow `prompts/_handoff.md`. Next: `prompts/opus-2-landing.md`, model Opus.
