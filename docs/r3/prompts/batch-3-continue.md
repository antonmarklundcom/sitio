# Continue round 3, batch 3 (paste into a new Claude Code session)

Repo: antonmarklundcom/sitio, base branch `main`. Works best as a **cloud
session on this repo** (no PC needed; MySQL 8 installs via apt in the
container). A local run works too if MySQL is available.

---

Continue round 3 batch 3 of this repo. Read first: `plan.md` §10 and §11.2,
`docs/r3/README.md` (Batch 3 section), `docs/log/R3-3.md` (the audit and
the tickets done so far), `KNOWN-ISSUES.md`, `docs/decisions-needed.md`,
`docs/r3/inbox.md`. The audit is done and merged (#51) — don't redo it, but
re-check `git log --oneline -15` in case something merged since.

Done: #51 audit, #52 R3-12 smoke re-runnable.

Remaining tickets, in this order (continue numbering from R3-13):
1. R3-13 remove unused `public/file.svg`, `globe.svg`, `window.svg`; give
   `scripts/theme-preview.tsx` a per-theme demo menu (salud = consultations,
   not dishes). QA gate: `npm run theme:preview`.
2. R3-14 landing `og:image` drawn in code (`src/app/opengraph-image.tsx` with
   `next/og` ImageResponse, text + brand colours). No AI image generation.
3. R3-15 `npm audit` esbuild findings: bump `drizzle-kit`, confirm
   `db:generate` shows no drift and `db:migrate` still works on fresh MySQL.
4. R3-16 menu item + product images. NO migration: `media.kind` already has
   `menu_item`/`product`, both tables have `media_id`. Allow those kinds for
   owners in `/api/upload` (tenant-checked), add to owner editors and
   renderers, delete the media when the item goes. Smoke.
5. R3-17 `products_view` analytics event (migration 0002 on the enum).
6. R3-18 per-CTA analytics column (`l` in the beacon; migration).
7. R3-19 split opening hours (siesta) in intake (`src/lib/hours.ts`).
8. R3-20 superadmin editing of owner menu/products with actor logging.
9. R3-21 PR-19b self-reported payments (owner reports method + reference +
   receipt ⇒ payment `reported`; admin confirms in existing billing panel).
10. R3-22 PR-22 VenderCRM push for hot leads (env-gated, no-op without key;
    use the vendercrm-lead-capture skill pattern).
11. R3-23 "tu año en cifras" yearly report page (the separable half of PR-20).
12. R3-24 full CSP once inline scripts are hashed/external.
13. R3-25 PR-18 extra pages module (`pages` table exists) — last, largest.

Rules:
- One branch `r3/R3-<n>` and one PR per ticket off latest `main`; merge when
  green, then start the next from the new `main`.
- Before each PR: `npm run typecheck && npm run lint && npm test`; `npm run
  build` if a route/config moves; `npm run smoke` (recipe in
  `tests/smoke/README.md`, fresh migrate+seed) if admin/intake/owner
  panel/upload is touched. The pre-push hook also runs build.
- Generate migrations with `npm run db:generate`, apply only to the local
  MySQL. Never to Hostinger — say in the PR and log that Anton imports it.
- After each ticket: remove it from `KNOWN-ISSUES.md` / strike it in plan §10,
  add its row to the table in `docs/log/R3-3.md` (same columns), commit.
- Blocked on Anton — do NOT guess, leave in place: `comercio` hide-menu
  decision (docs/decisions-needed.md), PR-17 WhatsApp Cloud API (Meta
  verification), PR-20 reminders (need PR-17), PR-21 R2 (only if Anton's
  uploads-persistence test fails), live Hostinger steps (import drizzle/0001
  + any new migrations, RESEND_API_KEY/RESEND_FROM, uploads dir, cron, DB
  password rotation). Inbox item on XFF-keyed rate limits needs Anton to
  check what Hostinger's proxy sends.
- Don't stop after one ticket. At the end, report: merged PRs, still blocked
  and why, anything new put in the inbox.
