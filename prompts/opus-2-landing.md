# Phase O2 — Landing page for sitio.com.py/. Opus session. Lane 1.

Read ONLY: this file, `plan.md` (phase table, §1, §4, §5.2, §9),
`docs/log/O1.md`, `docs/PLAN.md` §1.1–§1.2 and §4 D2/D5/D8 (the pitch and the
price band), `src/themes/fonts.ts`, `src/themes/servicios/servicios-theme.tsx`
(for the phone mock). Execute under plan §4. Build nothing outside §5.2.

Owns: `src/app/page.tsx`, `src/app/(landing)/**`, `src/components/landing/**`,
`src/styles/landing.css`, `public/landing/**`, `src/app/layout.tsx` (metadata
only), `.env.example` (append `NEXT_PUBLIC_SALES_WHATSAPP`), `src/lib/env.ts`
(one getter), `public/next.svg` + `public/vercel.svg` (delete), `docs/log/O2.md`.

Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn.

Phase rules:
- Branch `phase/O2` off latest `main`. WIP commit every 30 min.
- Load skill `nextjs-national-lead-gen` for section architecture and
  conversion pattern; `web-design-system` for tokens if available. Do NOT
  load Higgsfield or generate images (plan §5.2: no image budget).
- Copy: voseo Spanish, concrete, no superlatives. Price band exactly
  "desde ₲ 200.000 por año". Three-step "Cómo funciona". Five FAQ entries.
- Static route: no `db` import anywhere under the landing tree; the build
  output must show `○ /`.
- Phone mock: render a demo business through the servicios theme markup at
  reduced scale inside a CSS phone frame, or a hand-built static mock. Either
  is fine; it must not query the database.
- One CTA target: `env.salesWhatsapp` from `NEXT_PUBLIC_SALES_WHATSAPP`;
  missing → render the button with `href="#contacto"` and a
  console.warn at build, never crash.
- `generateMetadata`: canonical via `absoluteUrl("/")`, og tags, `es_PY`.
  JSON-LD `Organization` and `FAQPage` as two `<script type="application/ld+json">`.
- One screenshot pass at 360/768/1280 into `.preview/landing/` (git-ignored)
  using Playwright from `/opt/pw-browsers/chromium`; fix overflow, then stop.
- Re-runnable; minor issues → `docs/log/O2.md`; stop only per §4.4.

Exit:
- `grep -r "To get started" src` returns nothing; `public/next.svg` gone.
- `next build` lists `/` as static (○).
- `npm test` includes one test asserting the FAQ JSON-LD has 5 `Question`s
  (test the data array, not the DOM).
- No horizontal overflow at 360 px (Playwright check like `theme-shots.ts`).
- Pre-push green, PR merged, `docs/log/O2.md` written, §9 line added.

## After this phase
Follow `prompts/_handoff.md`. Next: `prompts/opus-3-ai-polish.md`, model Opus.
