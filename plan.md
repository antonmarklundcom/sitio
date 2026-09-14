# sitio.com.py — Improvement plan, round 2 (2026-09)

> This file is the build's memory. `docs/PLAN.md` is the product spec and stays
> authoritative for product decisions (D1–D10, schema, module semantics).
> This file is the *execution* plan for the next nine PRs: what each phase does,
> which model runs it, which files it owns, and how phases hand off.
> Background and reasoning: `docs/REPORT-2026-09.md`. Read that once; never
> re-derive its findings in a build session.
> 2026-09-13: four decisions added by the planning session (§1.11–§1.14):
> category-locked presentation and four themes (S3/S4 cancelled, S7 added),
> URL structure reconfirmed, price list, and the round-3 lane (§11).

## Phase table

| Phase | Lane | Model | Prompt | Plan §§ | Owns | Depends on |
|---|---|---|---|---|---|---|
| O1 hardening + test harness | 1 | Opus | `prompts/opus-1-hardening.md` | §5.1 | `package.json`, `package-lock.json`, `vitest.config.ts`, `tests/unit/**`, `tests/smoke/**`, `scripts/smoke-e2e.mjs`, `next.config.ts`, `.husky/pre-push`, `.gitignore`, `src/app/api/cron/rollup/route.ts`, `docs/log/O1.md` | — |
| O2 landing page | 1 | Opus | `prompts/opus-2-landing.md` | §5.2 | `src/app/page.tsx`, `src/app/(landing)/**`, `src/components/landing/**`, `src/styles/landing.css`, `public/landing/**`, `docs/log/O2.md` | O1 |
| O3 AI polish | 1 | Opus | `prompts/opus-3-ai-polish.md` | §5.3 | `src/lib/ai-polish.ts`, `src/app/admin/(dashboard)/sitios/polish-actions.ts`, `src/components/admin/polish-panel.tsx`, `tests/unit/ai-polish.test.ts`, `.env.example` (append), `docs/log/O3.md` | O1 |
| S1 products module (PR-14) | 2 | Sonnet | `prompts/sonnet-1-products.md` | §6.1 | `src/lib/product-form.ts`, `src/db/product-queries.ts`, `src/app/mi-sitio/product-actions.ts`, `src/components/mi-sitio/owner-products.tsx`, `src/components/site/products-section.tsx`, `src/themes/comercio/**`, `tests/smoke/products.mjs`, `docs/log/S1.md` | O1 |
| S2 theme `salud` | 2 | Sonnet | `prompts/sonnet-2-theme-salud.md` | §6.2 | `src/themes/salud/**`, `docs/log/S2.md` | O1 |
| ~~S3 theme `belleza`~~ | — | — | — | §1.12 | **Cancelled 2026-09-13.** `belleza` renders on theme `salud` with a locked palette. Prompt file retired. | — |
| ~~S4 theme `taller`~~ | — | — | — | §1.12 | **Cancelled 2026-09-13.** `taller` renders on theme `servicios` with a locked palette. Prompt file retired. | — |
| S5 upsell radar (PR-16) | 2 | Sonnet | `prompts/sonnet-5-radar.md` | §6.3 | `src/lib/radar.ts`, `src/db/lead-queries.ts`, `src/app/admin/(dashboard)/leads/**`, `src/components/admin/leads-*.tsx`, `tests/unit/radar.test.ts`, `tests/smoke/radar.mjs`, `docs/log/S5.md` | O1 |
| S7 category lock + price list | 2 | Opus (one-off, bake-off §11.0) | `prompts/sonnet-7-category-lock.md` (to be written, §7) | §6.5 | `src/lib/presentation.ts`, `tests/unit/presentation.test.ts`, `src/components/admin/theme-picker.tsx` (replace), `src/components/admin/business-form.tsx` (theme/palette block only), `src/app/admin/(dashboard)/sitios/actions.ts` (theme/variant derivation only), `src/app/admin/(dashboard)/alta/actions.ts` (theme/variant derivation only), `src/app/alta/[token]/actions.ts` (theme/variant derivation only), `PLAN_SUGGESTED_PRICE_GS` + `PLAN_LABELS` values in `src/lib/billing.ts`, `tests/smoke/presentation.mjs`, `docs/log/S7.md` | O1 |
| S6 link pass | — | Sonnet | `prompts/sonnet-6-link-pass.md` | §6.4 | cross-cutting only (see §6.4), `KNOWN-ISSUES.md`, `docs/log/S6.md` | S1, S2, S5, S7 |

Execution order: O1 → O2 → O3 sequentially in one Opus chain (each spawns the
next). O3 creates the watcher Routine and spawns S1, S2, S5, S7 at once (four
slots, all used). S6 is spawned by the watcher when S1, S2, S5 and S7 are
merged. S3 and S4 are cancelled (§1.12) and are never spawned; their prompt
files are retired before O1 starts (§7).

Append-only exceptions every phase may touch (§4.9): its own `docs/log/<id>.md`;
a new `/* == <id> == */` block at the end of `src/themes/theme.css`; one line in
`docs/decisions-needed.md`; plan §9's index line. The theme phase (S2) may
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
   for S1, S2, S5, S6; S7 runs on Opus as a one-off bake-off against
   Astra (§11.0). Never Fable (§4.8). Round 3 (§11) uses Astra via
   Codex CLI as the worker and Fable only in Anton's own window.
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
   `comercio`-specific override. S2 (`salud`) does not include it in its
   phase; S6 wires it into every theme.
7. **Theme design direction is fixed per theme** (§6.2). Palette registry
   rule holds: the four variants of one theme are ≥ 40° apart in hue and every
   text/base pair ≥ 4.5:1. Which variant a site gets is decided by §1.11.
8. **The radar score is computed nightly in the cron route**, never on read.
   Score formula in §6.3. Thresholds come from the existing
   `HOT_LEAD_WA_CLICKS_30D` / `HOT_LEAD_VIEWS_30D`.
9. **Screenshots are never committed.** `.preview/` stays git-ignored; the
   theme QA gate (`theme:preview` + `theme:shots`) writes there.
10. **Language:** customer/owner UI in voseo Spanish, superadmin UI in Swedish,
    code identifiers and this plan in English, commit messages in Swedish or
    English (both exist in history; either is fine).
11. **Presentation is locked by category (2026-09-13).** `themeKey` and
    `paletteVariant` are derived from `businesses.category` by one pure
    function, `presentationFor(category)` in `src/lib/presentation.ts`, and
    written on every path that creates or saves a business. No admin picker,
    no per-business choice, no override flag. The two columns stay in the
    schema (no migration) as the stored, always-in-sync result; the renderer
    keeps reading them. The mapping (theme / variant, using palettes that
    already exist and are contrast-verified in `docs/PALETTE-REGISTRY.md`):

    | Category | Theme | Variant | Accent |
    |---|---|---|---|
    | `servicios` | `servicios` | 2 | cyan 186° |
    | `taller` | `servicios` | 1 | orange 29° |
    | `comercio` | `comercio` | 1 | blue 212° |
    | `otro` | `comercio` | 2 | green 163° |
    | `gastronomia` | `gastronomia` | 1 | red-brown 11° |
    | `salud` | `salud` | 1 | teal (S2) |
    | `belleza` | `salud` | 2 | rose (S2) |

    Seven looks in production instead of twenty-four. Variants 3–4 of every
    theme (and 3–4 of `salud`) stay in `palettes.ts` as a dormant, verified
    reserve; nothing selects them. Two neighbours in the same category look
    the same by design — identity comes from logo, photos and AI-polished
    text, not from decoration. This overrides `docs/PLAN.md` §1.5's manual
    variant choice; §1.5 is rewritten to match. Built by S7 (§6.5).
12. **Four themes, not six.** `servicios` (dark, INDUSTRIAL), `comercio`
    (light, EDITORIAL), `gastronomia` (WARM CRAFT) and the new `salud` (light,
    CALM). `belleza` and `taller` are categories, not themes: S3 and S4 are
    cancelled. The `themeKey` enum keeps the values `belleza` and `taller`
    (no migration); `registry.ts` and `palettes.ts` never get entries for
    them and no row is ever written with them (S7 unit-tests that every
    category maps to a built theme). Every later cross-cutting change (S6,
    round 3) touches four theme directories, not six.
13. **Price list (2026-09-13, numbers approved by Anton the same day).** Two sold tiers, category never changes the
    price: Básico ₲ 300.000/year (one-page site, everything core), Plus
    ₲ 600.000/year (Básico + gallery + the category's content module: `menu`
    for gastronomia, `products` for comercio/otro, gallery-only for the rest).
    `pro` stays in the enum, reserved for `extra_pages`/`booking` (fase 3,
    suggested ₲ 900.000). Upgrade mid-year = the flat difference, same expiry
    date; renewal at the new tier's price. Full table in `docs/PLAN.md` §1.7.
    The landing (O2) says "desde ₲ 300.000 por año". `PLAN_SUGGESTED_PRICE_GS`
    is synced by S7. Admin keeps its free `priceGs` field (Anton negotiates);
    the list is the default, not a constraint.
14. **URL structure reconfirmed:** `sitio.com.py/[slug]`, path-based. No
    subdomains, no wildcard DNS or certificates on shared Hostinger hosting,
    one `NEXT_PUBLIC_BASE_URL`, domain authority shared from day one. Nothing
    in routing changes; `docs/PLAN.md` §1.11 carries the note.

## 2. Object model

Unchanged — `src/db/schema.ts` is authoritative. Relevant for this round:

- `businesses.description`, `seoTitle`, `seoDescription`, `servicesJson`,
  `aiPolishedAt` — written by O3.
- `businesses.upsellScore`, `hotLead`, `leadStage`, `adminNotes` — written by S5.
- `products` table, `media.kind = "product"`, `business_modules.products` — S1.
- `businesses.themeKey ∈ {servicios, comercio, gastronomia, salud}` — derived
  from `category` by S7 (§1.11); `salud` rendered by S2.

## 3. Feature scope

Core (this round): dependency fix, unit tests, security headers, landing
page, AI polish, products module, one theme (`salud`), category-locked
presentation and price list, upsell radar, link pass.

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
48 h); precio (two tiers from §1.13: "Básico ₲ 300.000 por año" and "Plus
₲ 600.000 por año" with what each includes, no per-module prices); FAQ (5 questions, FAQ JSON-LD); footer with the
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

After O3: create the watcher Routine and spawn S1, S2, S5, S7 per `prompts/_handoff.md`
(as synced per §7; S3/S4 are cancelled).

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

### 6.2 S2 — Theme `salud` (serves categories `salud` and `belleza`)

S3 (`belleza`) and S4 (`taller`) are cancelled by §1.12; this is the only
theme phase in the round. S2 builds `src/themes/salud/salud-theme.tsx`,
`salud.css`, four palettes appended to `palettes.ts` (the tuple type stays
four wide this round; only variants 1 and 2 are ever selected, §1.11), one
line in `registry.ts`, one CSS import in `src/app/[slug]/layout.tsx`, one
section in `docs/PALETTE-REGISTRY.md`. Read `servicios-theme.tsx` and
`comercio-theme.tsx` first for the props contract and the shared primitives
(`SiteImage`, `WhatsAppGlyph`, `SiteMenu`, hours/footer/status primitives in
`theme.css`). The theme must render the menu via `SiteMenu` when
`modules.has("menu")`, and must not reference products (S6 adds it).

Design direction (fixed, §1.7): **CALM, APPOINTMENT-FIRST.** One light theme
for the two "turno" businesses — clínica/dentista/consultorio and
salón/barbería/estética. Both live on being reachable and open; both are
sold by their photos. Light, cool-neutral base (near-white, faint blue-green
cast), one deep accent used only on the WhatsApp CTA, the "Abierto ahora"
state and link underlines; generous whitespace; 12 px radii; no grain; no
decorative shapes or gradients. Section map, different from every existing
theme's header comment: hero P1-style split with the name, the schedule and
"Abierto ahora" prominent; a photo block immediately after the hero showing
the first six photos (all photos when `gallery` is on) so a salon's site is
image-led without a second theme; "Servicios" as cards with short
descriptions; a "Cómo llegar" map block; trust ribbon "Turnos por WhatsApp";
socials row with Instagram first. Palettes, in this order: v1 teal (locked to
`salud`), v2 rose (locked to `belleza`), v3 navy, v4 sage (reserve). No
health claims and no beauty superlatives in template copy.

Restraint rule (applies to S2 and to every later theme edit in round 3):
the customer's logo, photos and polished text carry the page. Accent on at
most three element kinds; body text and headings in ink; hairlines, not
filled panels, separate sections. If a section reads as decoration with the
demo photos removed, cut it.

Rules: `.t-light` on the root; contrast per the registry rule (compute and
record the ratios in the registry section); sections use `.reveal`; WhatsApp
CTA sticky on mobile with `data-ev` attributes matching the other themes;
JSON-LD is provided by `RenderSite`, do not add another. QA gate: `npm run
theme:preview && npm run theme:shots salud` — no horizontal overflow at
360/768/1280 for all four variants (all four are built and verified; two are
selected). `THEME_LABELS` in `src/lib/business.ts` already has the label; do
not edit it. Do not touch the admin picker: S7 replaces it, and S7 reads
`BUILT_THEMES` from the registry, so S2 has no admin work.

Exit: registry shows the theme as built (`isThemeBuilt("salud")` true), QA
gate green for four variants, `PALETTE-REGISTRY.md` section with hue and
contrast table and the two locked variants marked, a unit test on
`BUILT_THEMES` including `salud`.

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

### 6.4 S6 — Link pass (after S1, S2, S5, S7 merged)

Cross-cutting edits only:

1. Add `<SiteProducts>` to `salud`, `servicios`, `gastronomia` guarded by
   `modules.has("products")`, styled by the shared block (S1 built the
   primitive; comercio has its own override). Four themes total (§1.12).
2. Verify `registry.ts`, `palettes.ts`, `layout.tsx` imports and
   `PALETTE-REGISTRY.md` are consistent after the parallel merges; verify
   `presentationFor` (S7) maps every category to a theme in `BUILT_THEMES`
   and that no code path still reads `themeKey`/`paletteVariant` from a form;
   run the full QA gate for all four themes once.
3. `npm run smoke` runs every `tests/smoke/*.mjs`; run it end to end against
   MySQL 8 once and record the count.
4. Retire `docs/HANDOVER.md`: replace its body with three lines pointing at
   `plan.md` §9 and `docs/log/`. Update README's "Teman", "Moduler" and
   "Röktest" sections to the new state (products built, four themes locked
   by category, price list, `npm test`). Update `docs/PLAN.md` §3 tables with
   "byggd" marks for PR-14/15/16 (PR-15 = S2 + S7).
5. Create root `KNOWN-ISSUES.md` from the still-open items across
   `docs/log/*.md`.
6. Delete the watcher Routine, write `docs/log/S6.md`, and end with the
   closing report (what shipped, what is open, the §7 items still needed
   from Anton). `KNOWN-ISSUES.md` plus §10 is the ticket source for round 3
   (§11); S6 does not start round 3.

### 6.5 S7 — Category-locked presentation and price list

Implements §1.11–§1.13. No schema change: `themeKey` and `paletteVariant`
stay, they stop being chosen.

1. `src/lib/presentation.ts`: `PRESENTATION_BY_CATEGORY` (the table in §1.11,
   typed against `CATEGORIES` and `THEME_KEYS` from `business.ts`),
   `presentationFor(category): { themeKey, paletteVariant }`, and
   `presentationLabel(category)` for the admin (Swedish, e.g.
   "servicios · variant 2 (cyan)"). Pure, no imports from `db` or React.
2. Write paths set both columns from `presentationFor(category)` and ignore
   any submitted `themeKey`/`paletteVariant`: `sitios/actions.ts` (create and
   update), `alta/actions.ts` (draft from intake link; replaces the inline
   `category === "otro" ? "servicios" : category` expression), and
   `src/app/alta/[token]/actions.ts` when the customer's submitted category
   differs from the prefilled one. The zod schema in `business.ts` stops
   requiring the two fields from the form; the server fills them.
3. Admin: replace `theme-picker.tsx` with a read-only block that shows the
   derived theme and a palette swatch for the currently selected category
   (client-side, listens to the `category` select so it updates before save)
   and the line "Tema och palett följer branschen (plan §1.11)". No hidden
   inputs. `business-form.tsx` keeps its layout; only the picker block
   changes. The "ej byggt än" warning stays, driven by `isThemeBuilt`
   (relevant until S2 merges).
4. `src/lib/billing.ts`: `PLAN_SUGGESTED_PRICE_GS` = basico 300 000, plus
   600 000, pro 900 000; `PLAN_LABELS` unchanged. Nothing else in billing
   moves (O1 owns its tests; they assert lifecycle, not prices).
5. Tests: `tests/unit/presentation.test.ts` — every `CATEGORIES` value maps
   to a key in `THEME_KEYS`, every variant is 1–4, and the mapping equals the
   §1.11 table literally (so a drift is a failing test, not a surprise);
   `tests/smoke/presentation.mjs` — create a business as `taller` in admin,
   assert the stored theme is `servicios`/1 and the public page root carries
   `.t-servicios` with the orange accent; change the category to `comercio`,
   assert it re-derives.

Owns: see the phase table. Not in scope: trimming the palette tuples, the
`themeKey` enum, `scripts/theme-preview.tsx` (it iterates `BUILT_THEMES` ×
4 and stays a QA tool for all built variants), seed data (`seed-dev.ts`
already matches the table for its three demo rows).

Exit: unit and smoke green; admin `nuevo` and `[id]` pages show the derived
presentation and no picker; `grep -rn 'formData.get("themeKey")' src` is
empty; pre-push green; PR merged; log + §9 line.

## 7. Human-inputs checklist (Anton)

| Item | Needed by | Status |
|---|---|---|
| Merge the plan PR so phases branch from a `main` that has `plan.md` | before O1 | ⬜ |
| Sync the prompt files with §1.11–§1.13: retire `prompts/sonnet-3-theme-belleza.md` and `prompts/sonnet-4-theme-taller.md`, write `prompts/sonnet-7-category-lock.md` from §6.5 (same shape as the S5 prompt), and change `S1–S5` to `S1, S2, S5, S7` in `prompts/_handoff.md`, `prompts/_watcher.md` and `prompts/sonnet-6-link-pass.md` (also "six themes" → "four"). Ten minutes by hand or one cheap Astra dispatch; the planning session was scoped to docs only | before O1 | ⬜ |
| Sign off the price numbers | — | ✅ 300k / 600k, 2026-09-13 |
| `ANTHROPIC_API_KEY` in local `.env.local` (to test O3 end to end) and in Hostinger env | O3 (degrades without) | ⬜ |
| `NEXT_PUBLIC_SALES_WHATSAPP` (your sales number, E.164) | O2 (degrades without) | ⬜ |
| Hostinger slot, database, env vars, `UPLOADS_DIR`, cron — deploy step A (README) | not a phase; do it whenever | ⬜ |
| Uploads-persistence test after first deploy (README) | after deploy A | ⬜ |
| `select now(), utc_timestamp();` on the Hostinger DB → set `ANALYTICS_TZ_OFFSET_HOURS` | after deploy A | ⬜ |
| Register `sitio.com.py` at NIC.py | before first paying customer | ⬜ |

## 8. Open business questions (parked)

- ~~Price of each module when sold separately~~ — decided §1.13: modules are
  not sold separately; Plus bundles them. Numbers approved: 300k / 600k.
- Whether AI polish should run automatically at intake submission (D7 says
  always run, reviewed). Decide after seeing 10 polished sites.
- Who approves when Anton is unavailable (`docs/PLAN.md` §5.8).

## 9. Build log index

| Phase | PR | Log |
|---|---|---|
| plan | this PR | — |
| O1 | #19 | docs/log/O1.md |
| O2 | #20 | docs/log/O2.md |
| O3 | #22 | docs/log/O3.md |
| S5 | #25 | docs/log/S5.md |
| S2 | #27 | docs/log/S2.md |
| S1 | #28 | docs/log/S1.md |
| S7 | #30 | docs/log/S7.md |
| S6 | #32 | docs/log/S6.md |

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
- Trim `ThemePalettes` to the variants actually selected once S7 has shipped
  and the QA tool no longer needs four (round 3, cheap tier).
- A superadmin presentation override (one flag) — only if a real customer
  case demands it; today the answer is no (§1.11).
- Decide whether `comercio` should hide `menu` when `products` is on (both
  render today, no conflict but duplicated info — S1, KNOWN-ISSUES.md).
- Shared logged-in `storageState` in `tests/smoke/_lib.mjs` (O1's file) so
  the smoke suite isn't exactly at the login rate limit's ceiling with five
  suites (O3, S6, KNOWN-ISSUES.md).

## 11. Round 3: Fable-led refinement, Astra workers

### 11.0 Bake-off on S7 (decided 2026-09-13, runs during round 2)

Anton wants one like-for-like comparison of Opus vs Astra before round 3
fixes the routing. S7 is the test piece: small-medium, self-contained,
measurable exit criteria (unit + smoke), no design taste involved. Rules:

- Same input: `prompts/sonnet-7-category-lock.md` (written from §6.5) for the
  Opus session; the Astra dispatch prompt is the same file rewritten into the
  skill's dispatch template, saved as `docs/r3/prompts/bakeoff-S7.txt`.
- Same base: both branch off `main` after O1 has merged (S7 needs vitest and
  `tests/smoke/_lib.mjs`). Opus on `phase/S7` (spawned by O3 as usual), Astra
  on `phase/S7-astra` (dispatched by Anton from his PC, `gpt-6-astra` low;
  escalate to high only if it fails the audit twice, and note it).
- Same judge: the manager (Fable, Anton's window) runs the §6.5 exit checks on
  both branches and reads both diffs. Record in `docs/log/S7-bakeoff.md`:
  wall-clock from first commit to green PR, Claude usage % and Codex usage
  consumed, exit criteria passed, defects found in review, lines changed.
- One branch merges (the one that passes with fewer review findings; ties go
  to the cheaper one). The other is deleted, not kept as reference.
- The result sets round 3's default: if Astra ties or wins, §11.1 stands as
  written; if Opus wins clearly on quality, normal-tier tickets stay on Astra
  but lane-1-style work (new layouts, multi-file foundations) goes to Opus
  sessions instead of Astra hard.


Starts only after S6 has merged and Anton has read its closing report. This
section is the design; nothing in it runs until Anton opens the first batch.
Round 2's model assignments above are untouched.

### 11.1 Shape

Manager/worker per skill `manager-worker-codex`, with Codex CLI as the
worker runtime and the tiers it verified. The manager is the one Fable
session Anton opens himself on his PC (the Codex wrapper is local:
`codex-run.ps1`, Windows, repo cloned there). The worker never sees the
manager's session; the manager never types code beyond the two-tool-call
rule.

| Role | Who | Does | Never |
|---|---|---|---|
| Manager | Fable 5.1, the live session Anton started | Picks the batch, writes each dispatch prompt with a definition of done, chooses the tier, runs the revision gate, merges, writes the batch log, reports | Runs as a subagent, spawned session, Workflow, Routine or watcher (`fable-cost-guardrail`, §4.8); edits more than two tool calls of code; merges a protected-path change it has not read line by line |
| Worker, cheap | `gpt-5.6-luna`, effort low | Renames, copy edits with the exact text, constant bumps, apply-an-existing-pattern-to-one-more-file, the `ThemePalettes` trim, AGENTS.md drop-in | Anything needing a design choice |
| Worker, normal | `gpt-6-astra`, effort low | Default: a KNOWN-ISSUES fix with a known cause, a new admin column, a theme section tweak under the restraint rule (§6.2), a new unit or smoke test, one- or two-file changes with judgment | Protected paths (below) |
| Worker, hard | `gpt-6-astra`, effort high | Multi-file refactors, bugs with no known cause, anything that failed twice at normal, and every protected-path ticket | Running migrations, pushing to `main`, editing `prompts/` or `plan.md` |
| Side tools | Sonnet or Opus subagent from the manager session, model set explicitly | Only a step Codex cannot reach from the PC (browser QA of a deployed page, Drive, Notion) | Being the worker for code |

Protected paths — Astra may edit them only at the hard tier, only when the
ticket names them in "Files to touch", and the manager reads the full diff
before the revision gate counts: `src/db/schema.ts`, `drizzle/**`,
`src/lib/auth*.ts`, `src/lib/session*.ts`, `src/middleware.ts`,
`src/lib/env.ts`, `src/lib/billing.ts`, `src/app/api/ev/**`,
`src/app/api/cron/**`, `src/app/api/upload/**`, `.husky/**`, `.env.example`.
Every other dispatch lists them under "Do not touch". Migrations are
generated by the worker and applied by Anton or the manager against a local
MySQL, never by the worker.

### 11.2 Ticket flow

1. **Source.** `KNOWN-ISSUES.md` (from S6), §10 backlog, entries Anton adds
   to `docs/r3/inbox.md` (one line each, free form). Nothing else generates
   work; a worker's "while I was there" finding becomes an inbox line, not a
   commit.
2. **Batch.** One Fable session = one batch of at most six tickets, chosen
   by the manager for value per Fable-minute: customer-visible defects
   first, then sales tooling (admin, radar, renewals), then internal
   hygiene. Ticket ids `R3-<n>`, listed in `docs/log/R3-<batch>.md` before
   the first dispatch.
3. **Dispatch.** One prompt per ticket from the skill's
   `assets/dispatch-prompt.txt`, saved to `docs/r3/prompts/R3-<n>.txt` and
   committed (they are the round's re-runnable memory, like `prompts/` was
   for round 2). Branch `r3/R3-<n>` off `main`. The prompt's "Commands to run
   before reporting" is always at least `npm run typecheck && npm run lint
   && npm test`; `npm run build` when a route or config moves; `npm run
   smoke` when the ticket touches admin, intake, owner panel or upload; the
   QA gate `npm run theme:preview && npm run theme:shots <key>` when a
   theme directory moves. The manager runs each listed command once itself
   before dispatching (the skill's rule: an unrunnable command is a paid
   failure).
4. **Revision gate** (skill §4, plus repo rules): the manager runs the same
   commands; `git diff --stat` matches "Files to touch"; "Flagged or not
   done" is empty or explicitly accepted; the restraint rule for theme
   diffs; an adversarial read of the full diff for protected paths and a
   read of the summary plus spot checks otherwise. Failure → resume the same
   session with the exact error, same tier. Escalation exactly as the skill:
   cheap fails once → normal; normal fails twice → hard; hard fails twice →
   the ticket goes back to the inbox with the manager's diagnosis, no third
   dispatch in the batch.
5. **Merge.** One PR per ticket, body ≤ 15 lines naming the Codex session
   id and the model/effort read from the session log. The pre-push hook is
   the CI; a red hook is the worker's job at the same tier. The manager
   merges; the worker never has `main`.
6. **Batch log** `docs/log/R3-<batch>.md`: per ticket one line with PR,
   session id, tier, gate result, findings rejected. Ends with the Fable
   turn count and the total Codex sessions used. That is the cost record.

### 11.3 What stays with the manager

Deciding what to build, acceptance criteria, all customer-facing copy and
Swedish admin copy (the worker types it, the manager writes it into the
prompt), theme direction and the restraint rule, anything under two tool
calls, reading protected-path diffs, merging, and every answer to Anton.
Product decisions (D1–D10, §1 here) are never re-litigated by a worker; a
ticket that needs one is written to `docs/decisions-needed.md` and waits.

### 11.4 Cost rules

- Fable runs only in the window Anton opened. No round-3 Routine, watcher,
  Workflow or spawned session on Fable, ever. If unattended follow-up is
  wanted (e.g. an hourly check that the six PRs merged), it is a Sonnet
  Routine that only reports; it dispatches nothing.
- Cheap first when the outcome is fully specified; normal by default; hard
  only when flagged or after two normal failures. Effort is per ticket, not
  per batch: a hard ticket's follow-ups go back to cheap.
- A batch ends when its tickets are merged or returned, not when the Fable
  session is long. Six tickets, one session, one log.
- The manager reports in the skill's format (task, session ids with model
  and effort from the log, what was verified, findings rejected, still
  open); the batch log is that report, committed.

### 11.5 First batch (proposed, not started)

R3-0 drop the skill's `AGENTS.md` into the repo root (cheap; the repo has
none). R3-1 trim `ThemePalettes` to the selected variants and adjust
`theme-preview.tsx` (cheap). R3-2..5 from `KNOWN-ISSUES.md` in S6's order.
Anton reorders freely; the manager writes the prompts.
