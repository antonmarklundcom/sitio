# sitio.com.py — Improvement plan, round 2 (2026-09)

> This file is the build's memory. `docs/PLAN.md` is the product spec and stays
> authoritative for product decisions (D1–D10, schema, module semantics).
> This file is the *execution* plan for the next nine PRs: what each phase does,
> which model runs it, which files it owns, and how phases hand off.
> Background and reasoning: `docs/REPORT-2026-09.md`. Read that once; never
> re-derive its findings in a build session.

## Phase table

| Phase | Lane | Model | Prompt | Plan §§ | Owns | Depends on |
|---|---|---|---|---|---|---|
| O1 hardening + test harness | 1 | Opus | `prompts/opus-1-hardening.md` | §5.1 | `package.json`, `package-lock.json`, `vitest.config.ts`, `tests/unit/**`, `tests/smoke/**`, `scripts/smoke-e2e.mjs`, `next.config.ts`, `.husky/pre-push`, `.gitignore`, `src/app/api/cron/rollup/route.ts`, `docs/log/O1.md` | — |
| O2 landing page | 1 | Opus | `prompts/opus-2-landing.md` | §5.2 | `src/app/page.tsx`, `src/app/(landing)/**`, `src/components/landing/**`, `src/styles/landing.css`, `public/landing/**`, `docs/log/O2.md` | O1 |
| O3 AI polish | 1 | Opus | `prompts/opus-3-ai-polish.md` | §5.3 | `src/lib/ai-polish.ts`, `src/app/admin/(dashboard)/sitios/polish-actions.ts`, `src/components/admin/polish-panel.tsx`, `tests/unit/ai-polish.test.ts`, `.env.example` (append), `docs/log/O3.md` | O1 |
| S1 products module (PR-14) | 2 | Sonnet | `prompts/sonnet-1-products.md` | §6.1 | `src/lib/product-form.ts`, `src/db/product-queries.ts`, `src/app/mi-sitio/product-actions.ts`, `src/components/mi-sitio/owner-products.tsx`, `src/components/site/products-section.tsx`, `src/themes/comercio/**`, `tests/smoke/products.mjs`, `docs/log/S1.md` | O1 |
| S2 theme `salud` | 2 | Sonnet | `prompts/sonnet-2-theme-salud.md` | §6.2 | `src/themes/salud/**`, `docs/log/S2.md` | O1 |
| S3 theme `belleza` | 2 | Sonnet | `prompts/sonnet-3-theme-belleza.md` | §6.2 | `src/themes/belleza/**`, `docs/log/S3.md` | O1 |
| S4 theme `taller` | 2 | Sonnet | `prompts/sonnet-4-theme-taller.md` | §6.2 | `src/themes/taller/**`, `docs/log/S4.md` | O1 |
| S5 upsell radar (PR-16) | 2 | Sonnet | `prompts/sonnet-5-radar.md` | §6.3 | `src/lib/radar.ts`, `src/db/lead-queries.ts`, `src/app/admin/(dashboard)/leads/**`, `src/components/admin/leads-*.tsx`, `tests/unit/radar.test.ts`, `tests/smoke/radar.mjs`, `docs/log/S5.md` | O1 |
| S6 link pass | — | Sonnet | `prompts/sonnet-6-link-pass.md` | §6.4 | cross-cutting only (see §6.4), `KNOWN-ISSUES.md`, `docs/log/S6.md` | S1–S5 |

Execution order: O1 → O2 → O3 sequentially in one Opus chain (each spawns the
next). O3 creates the watcher Routine and spawns S1–S5 at once (max 4 running;
the watcher starts the fifth). S6 is spawned by the watcher when S1–S5 are
merged.

Append-only exceptions every phase may touch (§4.9): its own `docs/log/<id>.md`;
a new `/* == <id> == */` block at the end of `src/themes/theme.css`; one line in
`docs/decisions-needed.md`; plan §9's index line. Theme phases (S2–S4) may
additionally add exactly one entry each to `src/themes/registry.ts`,
`src/themes/palettes.ts`, `src/app/[slug]/layout.tsx` (CSS import) and one
section to `docs/PALETTE-REGISTRY.md`. S1 may set `plannedIn: undefined` for
`products` in `src/lib/modules.ts` and add the products call to
`src/app/mi-sitio/page.tsx` and `src/db/site-queries.ts`. S5 may add one
`NAV` entry in `src/app/admin/(dashboard)/layout.tsx` and one call in
`src/app/api/cron/rollup/route.ts` (after O1 merged).

## 1. Decisions already made — do not re-litigate

Everything in `docs/PLAN.md` §1 (product), §2 (schema) and §4 (D1–D10) stands.
New decisions for this round:

1. **No new migrations in this round.** Every phase works with the schema as
   it is. `products`, `hotLead`, `upsellScore`, `leadStage`, `aiPolishedAt`,
   `menuItems.mediaId` all exist. A phase that thinks it needs a column writes
   the reason to `docs/decisions-needed.md` and works around it.
2. **Model per phase is fixed in the phase table.** Opus for O1–O3, Sonnet
   for S1–S6. Never Fable (§4.8).
3. **Unit tests are vitest, live in `tests/unit/`, run in `.husky/pre-push`
   before the build.** Smoke tests stay Playwright against a real MySQL and
   are not run by the hook. Each lane-2 phase adds `tests/smoke/<phase>.mjs`;
   the shared helpers live in `tests/smoke/_lib.mjs` (extracted by O1).
4. **The landing page is a static, prerendered route** with no database
   access, in Spanish (voseo), selling exactly three things: the one-page
   site, the WhatsApp-first pitch, and the price band. No customer directory
   (D5). One CTA: a wa.me link to Anton's sales number read from
   `NEXT_PUBLIC_SALES_WHATSAPP` (new env var, documented, gracefully absent =
   CTA shows the number placeholder and logs a warning at build).
5. **AI polish runs the Claude API from a server action, once per click,
   never at render time.** Model id comes from env `AI_POLISH_MODEL`,
   default `claude-opus-5` (cost per site is ~₲300 and the text is the
   product's SEO defence; Haiku is the fallback, not the default). Uses
   structured outputs (`output_config.format`) so the result is typed:
   `description`, `seoTitle`, `seoDescription`, `services[].desc`. Result is
   shown as a diff for review and written only when the admin clicks
   "Aplicar" (D7: always run, but reviewed before publishing). The raw text
   in `rawDescription` is never overwritten.
6. **Products render through a shared primitive** `products-section.tsx`
   (same pattern as `menu-section.tsx`), styled in `theme.css`, with a
   `comercio`-specific override. Themes 4–6 do not include it in their phase;
   S6 wires it into every theme.
7. **Theme design direction is fixed per theme** (§6.2). Palette registry
   rule holds: the four variants of one theme are ≥ 40° apart in hue and every
   text/base pair ≥ 4.5:1.
8. **The radar score is computed nightly in the cron route**, never on read.
   Score formula in §6.3. Thresholds come from the existing
   `HOT_LEAD_WA_CLICKS_30D` / `HOT_LEAD_VIEWS_30D`.
9. **Screenshots are never committed.** `.preview/` stays git-ignored; the
   theme QA gate (`theme:preview` + `theme:shots`) writes there.
10. **Language:** customer/owner UI in voseo Spanish, superadmin UI in Swedish,
    code identifiers and this plan in English, commit messages in Swedish or
    English (both exist in history; either is fine).

## 2. Object model

Unchanged — `src/db/schema.ts` is authoritative. Relevant for this round:

- `businesses.description`, `seoTitle`, `seoDescription`, `servicesJson`,
  `aiPolishedAt` — written by O3.
- `businesses.upsellScore`, `hotLead`, `leadStage`, `adminNotes` — written by S5.
- `products` table, `media.kind = "product"`, `business_modules.products` — S1.
- `businesses.themeKey ∈ {salud, belleza, taller}` — rendered by S2–S4.

## 3. Feature scope

Core (this round): dependency fix, unit tests, security headers, landing
page, AI polish, products module, three themes, upsell radar, link pass.

Not in scope: anything in §10.

## 4. Autonomy protocol

Every build session works under these rules. The prompt files reference this
section; do not paraphrase it there.

1. Work until the phase's exit criteria all pass; never ask permission for
   in-plan work.
2. One PR per phase: branch `phase/<id>` off latest `main`; create, watch and
   merge the PR when green (the pre-push hook is the CI: typecheck, lint, unit
   tests, build). A red build is always the session's own work. Lane 2 phases
   never wait for each other, only for lane 1.
3. Minor non-blocking issues go to the phase's `docs/log/<id>.md` "Known
   issues"; keep building. Only still-open, cross-phase items are promoted to
   the root `KNOWN-ISSUES.md` by the link pass.
4. Stop and ask ONLY for a missing credential with no graceful fallback, or a
   bad-foundation decision (schema, auth, money math, route contract) where a
   wrong guess forces a rewrite. "Ask" means: append the question to
   `docs/decisions-needed.md`, commit, push, end the session. Never wait in a
   session for an answer.
5. Missing env values never block: document in `.env.example`, degrade
   gracefully.
6. Every prompt is re-runnable: check what exists on the branch first and
   continue from the first unmet exit criterion. WIP commit at least every
   30 minutes.
7. Lane 2 hard limits: no schema, auth, session, middleware, env, billing or
   analytics-ingest changes; no edits outside the Owns block plus the listed
   append-only exceptions. Workaround plus a Backlog note instead.
8. **Model cost guardrail.** Fable (`claude-fable-*`, Mythos-class) is never
   used for build phases, subagents, spawned sessions, watchers or Routines.
   If a session believes Fable is needed it writes why to
   `docs/decisions-needed.md` and ends.
9. **File ownership.** A phase writes only to its Owns paths plus the
   append-only exceptions in the phase table. On `git merge main` conflicts:
   main wins, re-apply your own change on top, re-run the checks. Never edit
   a file outside your Owns block to resolve a conflict.
10. **Handoff.** A phase is done when four gates pass: PR merged green; exit
    checklist passed; one re-run of the checks on `main` plus one adversarial
    re-read of the merged diff with findings fixed in one follow-up commit;
    phase log committed. Then follow `prompts/_handoff.md`.
11. **Phase log** `docs/log/<id>.md`: ≤ 12 lines "Built", ≤ 8 "Decisions",
    ≤ 8 "Known issues", one line "Verification: checks green on <sha>". Add
    the index line to §9.
12. **Orientation read.** A fresh session reads: its prompt file, this file's
    phase table, §1, §4, its own §5/§6 section, §9, and `docs/log/<dep>.md`
    for each dependency. Not `docs/PLAN.md` end to end, not every log, not
    `docs/HANDOVER.md` (superseded).
13. **Polish cap.** Per phase: one screenshot pass (theme phases: the QA gate,
    once, after the last CSS change), no Lighthouse unless an exit criterion
    names a number, one smoke run reported. PR body written once, ≤ 25 lines.
    When every exit criterion passes, open the PR that turn; later ideas go
    to §10, not to commits.
14. **Decisions travel by files.** To change a running phase, edit its prompt
    on `main`; phases re-read their prompt before opening and before merging
    the PR. Never message a running session.
15. **No GitHub Actions**, ever, in this repo (`docs/RUNNER-POLICY.md`). The
    pre-commit hook blocks it; do not bypass with `--no-verify`.
16. **Local MySQL for smoke.** The recipe in `docs/HANDOVER.md` "Nästa
    session" step 5 (apt-get mysql-server, create db + user) is the verified
    way to get a database in a fresh container. Copy it into
    `tests/smoke/README.md` in O1 so nobody needs HANDOVER again.

## 5. Lane 1 phases (Opus, sequential)

### 5.1 O1 — Hardening and test harness

Goal: every later phase inherits a green, tested, patched baseline.

1. Dependencies: bump `sharp` and `next` (and `postcss` transitively) to the
   versions that clear `npm audit --omit=dev`. Patch-level only; if a clean
   audit needs a Next minor, take it and run the full smoke. Keep
   `react`/`react-dom` pinned as they are unless Next requires otherwise.
2. Vitest: add `vitest` (devDependency), `vitest.config.ts` with the `@/`
   alias, `npm test` script. Tests in `tests/unit/`, one file per module:
   `hours` (openState across midnight, closed days, Asunción tz, split
   intervals), `format` (normalizePyPhone valid/invalid/formatted inputs,
   formatGs, waLink encoding), `slug` (reserved, slugify accents, validate,
   uniqueSlugCandidate), `billing` (lifecycleStatus at boundaries, addDays,
   daysUntil, renewalMessage with and without stats), `analytics`
   (classifyDevice, referrerHost strips own host and paths, visitorHash is
   32 chars and day-dependent), `rollup` (dayRange length and order; export
   it or test through a small seam), `media` (resolveMediaPath rejects `..`,
   slashes, non-numeric id, accepts valid), `business` (canTransition table),
   `modules` (registry covers every enum key), `intake` (otpMatches,
   hoursFromIntake). Target ≥ 60 assertions. Modules importing `server-only`
   need `vi.mock("server-only", () => ({}))` in a setup file.
3. Pre-push hook: `typecheck && lint && test && build`.
4. Security: remove the `?key=` query form from `/api/cron/rollup` (bearer
   only; update README's curl line if it uses `?key=`; it does not today).
   Add `headers()` in `next.config.ts` for all routes: `X-Frame-Options:
   DENY` (customer sites are not embedded), `X-Content-Type-Options:
   nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
   `Permissions-Policy: camera=(), microphone=(), geolocation=()`. No CSP.
5. Hygiene: delete the `drizzle/0000_…sql` line from `.gitignore`.
6. Smoke split: move `chromium.launch`, the `ok()` helper, admin login and
   the base-URL constants from `scripts/smoke-e2e.mjs` into
   `tests/smoke/_lib.mjs`; `scripts/smoke-e2e.mjs` imports them and keeps
   its 75 checks. Add `tests/smoke/README.md` with the MySQL recipe (§4.16)
   and the run commands. `npm run smoke` runs `scripts/smoke-e2e.mjs` then
   every `tests/smoke/*.mjs` except `_lib.mjs` (a tiny runner script is
   fine). Restart-the-server note about the login rate limit stays.
7. Run the full smoke against a local MySQL once, after the dependency bump.

Exit: `npm audit --omit=dev` reports 0 vulnerabilities; `npm test` ≥ 60
passing assertions; pre-push runs tests; `curl /api/cron/rollup?key=…`
returns 403; response headers present on `/`; smoke 75/75 against MySQL 8.

### 5.2 O2 — Landing page (`/`)

Goal: `sitio.com.py/` sells the product instead of showing the Next.js
boilerplate. Load skill `nextjs-national-lead-gen` for structure and
`web-design-system` if available for tokens; do not load Higgsfield or
generate images (no image budget this round; use typographic and CSS
composition, or the three demo sites' screenshots only if they already exist
in the repo, which they do not, so: no images).

Sections, in order: hero (headline in voseo, one-line promise, WhatsApp CTA,
a phone-framed mock of a customer site built from the `servicios` theme
markup with demo data); "Qué incluye" (one-page, WhatsApp button, horario
with abierto-ahora, mapa, Google-ready SEO, estadísticas); "Cómo funciona"
(three steps: hablamos por WhatsApp, cargás tus datos y fotos, publicamos en
48 h); precio (single band "desde ₲ 200.000 por año", modules as upsells
listed without prices); FAQ (5 questions, FAQ JSON-LD); footer with the
sales WhatsApp and "Hecho en Paraguay".

Rules: static (`export const dynamic = "force-static"` or no dynamic APIs),
no DB, Bricolage/Inter Tight via the existing `src/themes/fonts.ts`,
palette taken from the admin/landing tokens not from any customer theme,
`generateMetadata` with canonical via `absoluteUrl("/")`, `Organization` +
`FAQPage` JSON-LD, one CTA target (`NEXT_PUBLIC_SALES_WHATSAPP`, decision
§1.4), mobile-first, no horizontal scroll at 360 px, unit test not required
(no logic). Remove `public/next.svg` and `public/vercel.svg` if unused.
Also update `src/app/layout.tsx` metadata title/description to the real
pitch (this file is shared but nothing else in the round touches it).

Exit: `/` prerenders as static in the build output; both JSON-LD blocks
validate (paste into schema validator or check shape in a unit test);
screenshots at 360/768/1280 with no overflow (Playwright, one pass, into
`.preview/landing/`); the phrase "To get started" no longer exists in the
repo.

### 5.3 O3 — AI polish ("Pulir textos")

Goal: an admin button on `/admin/sitios/[id]` that turns the customer's raw
text into unique, publishable copy, reviewed before it is written.

Load skill `claude-api` first and follow its TypeScript README: SDK
`@anthropic-ai/sdk`, `client.messages.create` with `output_config.format`
(JSON schema) so the response is typed; adaptive thinking omitted is fine;
`max_tokens` 4000; model from `env.aiPolishModel` (add getter, default
`claude-opus-5`); no streaming (short output).

1. `src/lib/ai-polish.ts`: `buildPolishInput(business)` (name, category,
   city/zone, rawDescription, servicesJson, hours summary), the system prompt
   (voseo, Paraguayan Spanish, no invented facts, no superlatives that make
   claims — "el mejor", "garantizado" — no health claims for `salud`,
   description 80–160 words, seoTitle ≤ 60 chars ending with city, seoDescription
   ≤ 155 chars, one `desc` ≤ 140 chars per service), `polishBusiness()`
   returning `{ description, seoTitle, seoDescription, services }`, and a pure
   `diffFields(current, proposed)` for the UI. Handle `stop_reason ===
   "refusal"` and API errors as a Swedish admin error, never a crash. Log
   `usage` to `activity_log` meta.
2. `polish-actions.ts`: `runPolishAction` (superadmin, tenant by id, rate
   limit 10/hour per process, stores the proposal in `activity_log` meta as
   `ai_polish_proposed` so a reload does not lose it) and `applyPolishAction`
   (writes the four fields, sets `aiPolishedAt`, logs `ai_polish_applied`,
   `revalidateTag`). `rawDescription` is never touched. Missing API key ⇒ the
   panel shows "ANTHROPIC_API_KEY saknas" and the button is disabled.
3. `polish-panel.tsx`: current vs proposed per field, per-field checkbox to
   apply, "Kör igen" and "Aplicera valda". Mounted in `sitios/[id]/page.tsx`
   below the business form (this one-line insertion is allowed for O3).
4. `tests/unit/ai-polish.test.ts`: prompt builder includes every input field,
   `diffFields` marks changed/unchanged, response validation rejects
   over-length fields (the API's schema mode guarantees shape, not length —
   clamp or reject in code).

Exit: unit tests green; with a real key set locally, one demo business
polished end to end and the diff shown; without a key, the panel degrades as
specified; `npm run smoke` unchanged and green (or a new
`tests/smoke/polish.mjs` covering the no-key state).

After O3: create the watcher Routine and spawn S1–S5 per `prompts/_handoff.md`.

## 6. Lane 2 phases (Sonnet, parallel)

Hard limits for every lane 2 phase: §4.7 and §4.9. No schema change, no auth
change, no env change, no edits to `scripts/smoke-e2e.mjs`, no edits to
another theme's directory.

### 6.1 S1 — Products module (PR-14)

Copy the menu chain exactly (`docs/log/O1.md` will say whether the smoke
helpers moved; `docs/HANDOVER.md` "Nästa session: PR-14" has the file map):
`menu-form.ts → product-form.ts`, `menu-queries.ts → product-queries.ts`,
`menu-actions.ts → product-actions.ts` with the same server-side module
check (`ownerContext` + module enabled, never trust the UI), `owner-menu.tsx
→ owner-products.tsx` (name, description ≤ 300, price in Gs or empty =
"A consultar", visible toggle, move up/down, cap 60 products). Public
rendering: `src/components/site/products-section.tsx` (`<SiteProducts>`),
same shape as `SiteMenu`. Products have no view event in the analytics enum
(§1.1: no migrations), so render without `data-ev-view` and note it in the
log. Styles as a
`/* == S1 == */` block in `theme.css` plus a `.t-comercio` override in
`comercio.css`. `site-queries.ts`: load products only when the module is on
(same shape as menu). `mi-sitio/page.tsx`: mount the editor when the module
is on. `modules.ts`: drop `plannedIn` for `products`. Product images
(`media.kind = "product"`) are out of scope this round, same as menu item
images; say so in the log.

Exit: `tests/smoke/products.mjs` covers module off → on, create two products,
empty price renders "A consultar", hidden product absent from the public
site, module off hides section without deleting rows; comercio theme
screenshot via the QA gate once; unit test for the product form parser.

### 6.2 S2–S4 — Themes `salud`, `belleza`, `taller`

Each phase builds one theme: `src/themes/<key>/<key>-theme.tsx`,
`<key>.css`, four palettes appended to `palettes.ts`, one line in
`registry.ts`, one CSS import in `src/app/[slug]/layout.tsx`, one section in
`docs/PALETTE-REGISTRY.md`. Read `servicios-theme.tsx` and `comercio-theme.tsx`
first for the props contract and the shared primitives (`SiteImage`,
`WhatsAppGlyph`, `SiteMenu`, hours/footer/status primitives in `theme.css`).
The theme must render the menu via `SiteMenu` when `modules.has("menu")`,
and must not reference products (S6 adds it).

Design direction (fixed, §1.7):

- **salud** — CALM TRUST. Light, cool base (near-white with a blue-green
  cast), one deep accent, generous whitespace, rounded 12 px radii, no grain,
  hero P1-style split with the schedule and "Abierto ahora" prominent (a
  clinic's first question is "are they open"), a "Servicios" list as cards
  with short descriptions, a "Cómo llegar" map block, trust ribbon with
  "Turnos por WhatsApp". Palettes: teal, navy, sage, plum. No health claims
  in template copy.
- **belleza** — SOFT GALLERY. Light warm base, editorial serif feel achieved
  with the existing display font at lighter weight and wide tracking,
  image-led: hero is a full-bleed photo with the name overlaid, then a
  masonry-ish gallery of up to six photos (all photos when `gallery` is on),
  services as a two-column price-less list, socials prominent (Instagram
  first). Palettes: rose, terracotta, lilac, olive.
- **taller** — ROBUST DIRECT. Dark, high-contrast like `servicios` but with a
  different section map (so the two are not twins): hero is a P9 oversized
  statement with the phone number as the headline element, then a
  "Qué arreglamos" grid, then a "Horario y ubicación" sticky-side block,
  then a photo strip. Chunkier borders (2 px), square corners, mono-style
  numerals for the phone. Palettes: safety-orange, yellow, red, steel-blue.
  Must differ from `servicios` variant hues by ≥ 20° where the same family is
  used.

Rules for all three: `.t-light` on the root for light themes; contrast per
the registry rule (compute and record the ratios in the registry section);
sections use `.reveal`; WhatsApp CTA sticky on mobile with `data-ev`
attributes matching the other themes; JSON-LD is provided by `RenderSite`,
do not add another. QA gate: `npm run theme:preview && npm run theme:shots
<key>` — no horizontal overflow at 360/768/1280 for all four variants.
`THEME_LABELS` in `src/lib/business.ts` already has the label; do not edit it.

Exit: registry shows the theme as built (`isThemeBuilt` true), QA gate green
for four variants, `PALETTE-REGISTRY.md` section with hue and contrast
table, admin theme picker shows it selectable (it reads the registry; verify
by screenshot or by a unit test on `BUILT_THEMES`).

### 6.3 S5 — Upsell radar (PR-16)

`src/lib/radar.ts`: `computeUpsellScore(stats)` pure function.
Score = min(100, round(0.5 × waClicks30d + 0.05 × views30d + 10 × (has
gallery photos ≥ 8) + 10 × (menu or products enabled) + 15 × (subscription
active and > 200 days remaining))); `hotLead = waClicks30d ≥
HOT_LEAD_WA_CLICKS_30D || views30d ≥ HOT_LEAD_VIEWS_30D`. `runRadar()` in
`src/db/lead-queries.ts` updates every published business in one pass from
`analytics_daily` (never from raw events) and logs `radar_run` once. Called
from the cron route after the billing lifecycle (one added line, allowed).
`/admin/leads`: table sorted by score desc, columns score, hot flag, stage,
30-day views and clicks, last contact note; per-row `leadStage` buttons
(ninguno → contactado → cotizado → vendido, any direction), inline
`adminNotes` textarea with save, and a wa.me pitch link using
`renewalMessage`-style stats text ("Tu página tuvo N visitas y M contactos
en 30 días"). Add "Leads" to `NAV`. Unit test the score function at the
boundaries; smoke: seed two businesses with different daily rows, run the
cron route with the bearer, assert order and hot flag.

Exit: unit and smoke green; `/admin/leads` renders; `hotLead` and
`upsellScore` populated after one cron call; the dashboard's existing hot-lead
column reflects it.

### 6.4 S6 — Link pass (after S1–S5 merged)

Cross-cutting edits only:

1. Add `<SiteProducts>` to `salud`, `belleza`, `taller`, `servicios`,
   `gastronomia` guarded by `modules.has("products")`, styled by the shared
   block (S1 built the primitive; comercio has its own override).
2. Verify `registry.ts`, `palettes.ts`, `layout.tsx` imports and
   `PALETTE-REGISTRY.md` are consistent after three parallel merges; run the
   full QA gate for all six themes once.
3. `npm run smoke` runs every `tests/smoke/*.mjs`; run it end to end against
   MySQL 8 once and record the count.
4. Retire `docs/HANDOVER.md`: replace its body with three lines pointing at
   `plan.md` §9 and `docs/log/`. Update README's "Teman", "Moduler" and
   "Röktest" sections to the new state (products built, six themes, `npm
   test`). Update `docs/PLAN.md` §3 tables with "byggd" marks for PR-14/16.
5. Create root `KNOWN-ISSUES.md` from the still-open items across
   `docs/log/*.md`.
6. Delete the watcher Routine, write `docs/log/S6.md`, and end with the
   closing report (what shipped, what is open, the §7 items still needed
   from Anton).

## 7. Human-inputs checklist (Anton)

| Item | Needed by | Status |
|---|---|---|
| Merge the plan PR so phases branch from a `main` that has `plan.md` | before O1 | ⬜ |
| `ANTHROPIC_API_KEY` in local `.env.local` (to test O3 end to end) and in Hostinger env | O3 (degrades without) | ⬜ |
| `NEXT_PUBLIC_SALES_WHATSAPP` (your sales number, E.164) | O2 (degrades without) | ⬜ |
| Hostinger slot, database, env vars, `UPLOADS_DIR`, cron — deploy step A (README) | not a phase; do it whenever | ⬜ |
| Uploads-persistence test after first deploy (README) | after deploy A | ⬜ |
| `select now(), utc_timestamp();` on the Hostinger DB → set `ANALYTICS_TZ_OFFSET_HOURS` | after deploy A | ⬜ |
| Register `sitio.com.py` at NIC.py | before first paying customer | ⬜ |

## 8. Open business questions (parked)

- Price of each module when sold separately (D2 said packages; the admin
  still sets the price by hand). Not build work.
- Whether AI polish should run automatically at intake submission (D7 says
  always run, reviewed). Decide after seeing 10 polished sites.
- Who approves when Anton is unavailable (`docs/PLAN.md` §5.8).

## 9. Build log index

| Phase | PR | Log |
|---|---|---|
| plan | this PR | — |

(Phases append one line each: `| O1 | #nn | docs/log/O1.md |`.)

## 10. Backlog

- PR-17 WhatsApp Cloud API (needs Meta verification, D6).
- PR-18 Extra pages module.
- PR-19 Self-service signup and self-reported payments.
- PR-20 Renewal automation and "tu año en cifras".
- PR-21 R2 migration (only if the uploads-persistence test fails).
- PR-22 VenderCRM push for hot leads.
- Menu item and product images (`media.kind` menu_item/product through
  `/api/upload` for owner sessions).
- Superadmin editing of owner menu/products with actor logging.
- Split opening hours (siesta) in intake.
- Per-CTA analytics column (`l` in the beacon is dropped today).
- Move rate limits and lazy rollup to the DB if a second Node process ever
  exists.
- Full CSP once inline scripts move to hashed or external files.
