# Round 3, batch 4 — go live with batch 3, then small tickets

Paste everything below the line into a new Claude Code session on Opus 5.5
(cloud session on antonmarklundcom/sitio, base branch `main`). Anton is at the
keyboard for part A; part B runs on its own afterwards.

---

Run round 3 batch 4 of this repo. You are manager and worker in one session,
same process as batch 3. Anton is working today and will do the Hostinger
steps himself while you guide and verify.

Read first: `docs/log/R3-3.md` (batch 3 — tickets, "Batch close", "Live
steps for Anton"), `docs/deploy/hostinger-import-0001-0003.sql`,
`KNOWN-ISSUES.md`, `docs/decisions-needed.md`, `docs/r3/inbox.md`, plan.md
§10 and §11.2, README "Deploy till Hostinger". Then `git log --oneline -15`.
Create `docs/log/R3-4.md` with the same table columns as R3-3 before the
first ticket.

## Part A — take batch 3 live (Anton does the clicks, you guide + verify)

Do R3-26 (below) FIRST and merge it, because steps 4–5 need it. Then walk
Anton through these one at a time, waiting for his "done" each time. Never
ask him to paste a secret into the chat; ask yes/no or "what does the page
show".

1. **Import the migrations** in phpMyAdmin: `docs/deploy/hostinger-import-0001-0003.sql`
   with `CHANGE_ME_DATABASE` replaced by the app's database. It is
   re-runnable and was tested on MariaDB (0000-only DB → import twice →
   `db:migrate` "No pending migrations"). The last two SELECTs should show 4
   journal rows and a `cta_loc` column — ask Anton to confirm that.
   Import BEFORE deploying: the new code writes `cta_loc`.
2. **Env vars in hPanel** (then redeploy): `RESEND_API_KEY` + `RESEND_FROM`;
   `NEXT_PUBLIC_SALES_WHATSAPP` (needed for the renew button on "tu año en
   cifras" and the landing CTA; it is baked in at build, so it must be set
   before the deploy); optional `VENDERCRM_URL` + `VENDERCRM_API_KEY` (only
   if Anton wants hot leads in VenderCRM now — see R3-22 in the log).
3. **Redeploy `main`** (hPanel → Node.js app → Git → deploy). This ships the
   stored-XSS fix from R3-24 — the most urgent part.
4. **Verify from the cloud** against the live domain Anton gives you (curl,
   no login): `/` has `content-security-policy` and an absolute `og:image`
   on the live domain; `/opengraph-image` is a 200 PNG; `/sitemap.xml`
   lists sites; a customer site's JSON-LD contains `<` escapes if any
   text has `<`; `/reporte/<slug>` without a token is 404; `POST /api/ev`
   is 204. Report pass/fail per line.
5. **Anton opens `/admin/diagnostico`** (R3-26) and tells you what it shows:
   the forwarded-for headers (decides R3-27), `now()` vs `utc_timestamp()`
   (decides whether `ANALYTICS_TZ_OFFSET_HOURS=-3` is right), uploads dir
   writable, which env vars are set (yes/no only).
6. **Batch-2 leftovers**, each only if Anton has time: uploads dir outside
   the app dir, the uploads-persistence test (upload → redeploy → same
   `/media/…` URL still 200; a fail un-blocks PR-21 R2), hPanel cron for
   `/api/cron/rollup` with the bearer header, DB password rotation (update
   the env var in the same sitting — see the nextjs-deploy-hostinger skill).
7. **Smoke on live, by hand, with Anton:** in `/admin/sitios/<id>` check
   "Clics por botón", "Carta y productos", "Páginas adicionales" (only when
   the module is on), "Año en cifras →"; in `/mi-sitio` (as a customer)
   "Tu plan" and the report link. Never run `npm run smoke` against
   production — it writes to the database.

Write what was done and what failed into `docs/log/R3-4.md` ("Live steps")
and strike the done items from R3-3's "Live steps for Anton".

## Part B — tickets (one branch `r3/R3-<n>` + one PR each, merge when green)

1. **R3-26 `/admin/diagnostico`** (superadmin only, noindex, no caching):
   request headers `x-forwarded-for`, `x-real-ip`, `forwarded`,
   `cf-connecting-ip`, `host`, `x-forwarded-proto`; what `clientIp()`
   returns today; DB `version()`, `now()`, `utc_timestamp()`, `@@time_zone`;
   `UPLOADS_DIR` exists + writable (write and delete a temp file); env
   presence as yes/no for RESEND_*, NEXT_PUBLIC_SALES_WHATSAPP,
   VENDERCRM_*, ANTHROPIC_API_KEY, CRON_SECRET — **never a value**. Link it
   from the admin header. Smoke: superadmin sees it, owner and anonymous are
   redirected.
2. **R3-27 rate limits keyed on the trusted hop** — only after Anton has
   read the headers in A5. Today `registro`, `mi-sitio/login` and
   `analytics.ts` key on the FIRST `x-forwarded-for` entry, which the client
   controls (inbox 2026-09-22). Key on what Hostinger's proxy actually sets
   (last hop, or `x-real-ip`), in one helper used everywhere. If the answer
   is unclear, leave it in the inbox with what the page showed.
3. **R3-28 admin hours through `normalizeIntervals()`** (inbox, R3-19):
   `hoursFromFormData` in `src/lib/business.ts`. Unit tests.
4. **R3-29 extra pages polish** (inbox, R3-25): `BreadcrumbList` JSON-LD on
   `/[slug]/[page]` via `jsonLdHtml()`; add one subpage per theme to
   `theme:preview` / `theme:shots`.
5. **R3-30 `comercio` menu vs products** — ONLY if Anton has answered in
   `docs/decisions-needed.md`. Ask him in part A. (a) = hide `menu` in
   `comercio` when `products` is on; (b) = close the question, no code.
6. Stop there. Anything else found goes to `docs/r3/inbox.md`.

## Rules (same as batch 3)

- Branch off the latest `main` per ticket; PR body ≤ 15 lines; merge when
  green, then the next ticket from the new `main`.
- Before each PR: `npm run typecheck && npm run lint && npm test`; `npm run
  build` when a route/config moves (the pre-push hook builds anyway);
  `npm run smoke` on a fresh local DB when admin/intake/owner/upload moves —
  twice in a row if you touched the smoke files.
- Migrations: `npm run db:generate`, apply only locally, never to Hostinger;
  if one is needed, extend the idea of `docs/deploy/` with a guarded,
  re-runnable import file for Anton.
- After each ticket: log row in `docs/log/R3-4.md`, update
  KNOWN-ISSUES / plan §10 / inbox, commit in the same PR.
- Model rule (fable-cost-guardrail): this session is Opus 5.5 in Anton's
  window. Subagents, if any, are Sonnet or Opus with the model set
  explicitly — never Fable, no Routines or spawned sessions.
- End with a short report: merged PRs, live steps done/failed, still blocked
  and why, new inbox lines, and what Anton should do next.

## Environment notes learned in batch 3

- Local DB: `apt-get install -y mysql-server` (recipe in `tests/smoke/README.md`)
  or `mariadb-server` (closer to Hostinger; batch 3's full smoke also passed
  on MariaDB 10.11 with a fresh datadir: `mariadb-install-db --datadir=/tmp/mdb`,
  then `mariadbd --user=mysql --datadir=/tmp/mdb --socket=/run/mysqld/mysqld.sock`).
- Stop the server with `fuser -k 3100/tcp`, not `pkill -f next…` — the
  pattern matches the shell running the command and kills it.
- `unstable_cache` survives restarts in `.next/cache/fetch-cache`; delete it
  after editing the DB by hand, or the site shows old data.
- Playwright's `page.request` does not send the `Secure` session cookie over
  http (production build) → use `page.evaluate(() => fetch(…))`.
- Playwright cannot read `sendBeacon` bodies → wrap `navigator.sendBeacon`
  in `addInitScript` (see `tests/smoke/products.mjs`).
- Owner login codes are limited to 4 per number per 15 min. Put new owner
  steps inside `scripts/smoke-e2e.mjs` or `tests/smoke/products.mjs` (they
  already log in); a new suite with its own owner login breaks the
  "two runs in a row" guarantee.
- Heredocs can turn ` ` in source into the literal character and break
  the parser — write such escapes with Python or the Edit tool.
