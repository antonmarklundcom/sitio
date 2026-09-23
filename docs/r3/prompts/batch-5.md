# Round 3, batch 5 — take batches 3 + 4 live, then the review leftovers

Paste everything below the line into a new Claude Code session on Opus 5.5
(medium or high effort), cloud session on antonmarklundcom/sitio, base
branch `main`. Anton is at the keyboard for part A; part B runs on its own.

---

Run round 3 batch 5 of this repo. You are manager and worker in one session,
same process as batches 3 and 4. Anton is at the keyboard for part A and does
the hPanel/phpMyAdmin clicks; you guide one step at a time and verify from
the cloud. Never ask him to paste a secret; ask yes/no or "what does the
page show".

Read first: `docs/log/R3-4.md` (whole file — tickets, "Review findings",
"Batch close", "Live steps"), `docs/log/R3-3.md` "Live steps for Anton",
`docs/deploy/hostinger-import-0001-0003.sql`, `KNOWN-ISSUES.md`,
`docs/decisions-needed.md`, `docs/r3/inbox.md`, plan.md §10 and §11.2,
README "Deploy till Hostinger". Then `git log --oneline -25`. Create
`docs/log/R3-5.md` with the same table columns as R3-4 before the first
ticket.

Local DB for smoke: MariaDB (`apt-get install -y mariadb-server`,
`mariadb-install-db --user=mysql --datadir=/tmp/mdb`, `mariadbd
--user=mysql --datadir=/tmp/mdb --socket=/run/mysqld/mysqld.sock &`, then the
user/db from `tests/smoke/README.md`). If smoke suddenly fails every login
with ECONNREFUSED, mariadbd died (seen in batch 4) — restart it on the same
datadir. Stop the app with `fuser -k 3100/tcp`. Delete
`.next/cache/fetch-cache` after editing the DB by hand.

## Part A — go live (nothing of batches 3 or 4 is on Hostinger yet)

Main now holds batch 3 (R3-12…R3-25) and batch 4 (R3-26…R3-38), including
several security fixes (stored XSS in JSON-LD R3-24, intake links on
published sites R3-33, sessions of disabled owners R3-34, reusable reset
links R3-37). Walk Anton through, one step at a time, waiting for "done":

1. **Import** `docs/deploy/hostinger-import-0001-0003.sql` in phpMyAdmin:
   select the app's database in the left column, SQL tab, paste the file,
   delete the `USE \`CHANGE_ME_DATABASE\`;` line, Go. Ask: 4 journal rows?
   `cta_loc` row shown? any red error? Batch 4 added no migration.
2. **Env vars in hPanel**: `RESEND_API_KEY` + `RESEND_FROM`,
   `NEXT_PUBLIC_SALES_WHATSAPP` (baked in at build — set before deploying),
   optional `VENDERCRM_URL` + `VENDERCRM_API_KEY`. Leave `CLIENT_IP_SOURCE`
   unset for now.
3. **Redeploy `main`** (hPanel → Node.js app → Git → deploy).
4. **Verify from the cloud** (curl, no login) against the live domain Anton
   gives you: `/` has `content-security-policy` and an absolute `og:image`;
   `/opengraph-image` 200 PNG; `/sitemap.xml` lists sites; a customer site
   has `data-hours` on the open/closed pill and a JSON-LD block;
   `/<slug>/<page>` of a site with extra pages has a `BreadcrumbList`;
   `/reporte/<slug>` without a token is 404; a slug starting with "admin"
   (if any) is not redirected. Report pass/fail per line.
5. **Anton opens `/admin/diagnostico`** and tells you: the six headers, what
   "clientIp() hoy" and the three "si fuera …" rows show, now() vs
   utc_timestamp() (0 h ⇒ `ANALYTICS_TZ_OFFSET_HOURS=-3` is right), uploads
   dir exists / writable / outside the app, env yes/no. Have him compare
   the three "si fuera …" rows with his real public IP (whatismyip.com).
   **Finish R3-27:** the right source is one that equals his real IP and is
   written by the proxy, not the browser: prefer `x-real-ip` if it is set,
   else `xff-last`; `xff-first` only if the raw `x-forwarded-for` has exactly
   one entry (Hostinger replaces the header). Set `CLIENT_IP_SOURCE` in hPanel
   to that source and redeploy (or change the default in `src/lib/client-ip.ts`
   in a small PR), then strike the KNOWN-ISSUES line. If it is unclear, leave
   it in the inbox with what the page showed.
6. **Batch-2 leftovers**, each only if Anton has time: uploads dir outside
   the app dir (diagnostics tells you), the uploads-persistence test (upload
   a photo → redeploy → same `/media/…` URL still 200; a fail un-blocks
   PR-21 R2), hPanel cron for `/api/cron/rollup` with the bearer header, DB
   password rotation (update the env var in the same sitting).
7. **Smoke on live by hand**: `/admin/sitios/<id>` ("Clics por botón",
   "Carta y productos", "Páginas adicionales", "Año en cifras →", the payment
   form now prefilled with the NEXT period); `/mi-sitio` as a customer ("Tu
   plan", report link, a wrong price like "35 mil" keeps the name). Never run
   `npm run smoke` against production.
8. **Ask Anton the open questions** (write the answers into
   `docs/decisions-needed.md`): (a) `comercio` hide `menu` when `products` is
   on, or leave both (R3-30); (b) should the admin UI be all Spanish — today
   the publish blockers, form validation and some billing messages are
   Swedish under Spanish headings; (c) should the free trial start at
   publication instead of at registration.

Write done/failed into `docs/log/R3-5.md` ("Live steps") and strike the
done items from R3-3's "Live steps for Anton" and R3-4's "Live steps".

## Part B — tickets (one branch `r3/R3-<n>` + one PR each, merge when green)

Take them in this order; all come from batch 4's review (R3-4 "Review
findings") and are verified against the code there, but re-read the code
before changing it.

1. **R3-30** — only if Anton answered (a) in part A.
2. **R3-39 admin business form**: service limits 80/200 vs intake/owner
   120/300 (admin can't save a site the customer filled); nested zod errors
   (`servicesJson.0.name`, `hoursJson.fri.0`) are never rendered — show them;
   keep values on error with `src/lib/kept-form.ts` like R3-38 did for the
   customer forms. Smoke: admin saves a site with a 110-char service name.
3. **R3-40 confirm before destructive owner actions**: "Borrar sección"
   (up to 40 dishes + images), delete dish/product/photo — a
   `confirm()`-style second tap, no modal library. Smoke must still pass
   (update the clicks).
4. **R3-41 small correctness batch**: rollup fallback runs once per process
   per day, so owners' "today" goes stale (limit to every ~10 min,
   `src/lib/rollup.ts`); "30 days" windows are 31 days on the UTC date
   (`src/db/lead-queries.ts`, `src/db/queries.ts` — use `> 29 days` on the
   Asunción day); a valid preview link on an already published site should
   redirect to the public URL (`src/app/preview/[slug]/page.tsx`); theme home
   pages lack a `<main>` landmark.
5. **R3-42 input hygiene**: `secondaryPhone` through `normalizePyPhone` with
   a Spanish message (intake, owner); owner/intake `mapsUrl` and social links
   require `https?://` like the admin; logo replace deletes the old files on
   disk (`/api/upload`); honour `?next=` after admin/owner login (same-origin
   relative paths only); `saveItem` enforces the per-section cap when an item
   moves section; `IntakeSubmit` pending state; `OtpButton` pending state.
6. **R3-43 Spanish admin copy** — only if Anton answered (b) "yes".
7. Stop there. Anything new goes to `docs/r3/inbox.md`.

## Rules (same as batches 3 and 4)

- Branch off the latest `main` per ticket; PR body ≤ 15 lines; merge when
  green, then the next ticket from the new `main`. There is no GitHub CI —
  the pre-push hook (build) plus your gate is the check.
- Before each PR: `npm run typecheck && npm run lint && npm test`; `npm run
  build` when a route/config moves; `npm run smoke` on the local DB when
  admin/intake/owner/upload moves — twice in a row if you touched the smoke
  files.
- Migrations: `npm run db:generate`, apply only locally, never to Hostinger;
  if one is needed, write a guarded re-runnable import file in `docs/deploy/`.
- After each ticket: log row in `docs/log/R3-5.md`, update KNOWN-ISSUES /
  plan §10 / inbox, commit in the same PR.
- Model rule (fable-cost-guardrail): this session is Opus 5.5 in Anton's
  window. Subagents, if any, are Sonnet or Opus with the model set
  explicitly — never Fable, no Routines or spawned sessions.
- End with a short report: merged PRs, live steps done/failed, still blocked
  and why, new inbox lines, and what Anton should do next.
