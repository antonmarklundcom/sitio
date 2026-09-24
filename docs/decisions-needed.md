# Decisions needed from Anton

Build sessions append a dated question here and end (plan §4.4). The watcher
notifies Anton. Answer inline under the question, commit to `main`; the next
run of the phase reads it.

## Open

- 2026-09-14 — **`comercio` renders both catálogo (`products`) and "Nuestra
  lista" (`menu`)** when a business has both modules on (S1, KNOWN-ISSUES.md).
  Options: (a) hide `menu` in the `comercio` theme once `products` is on,
  (b) leave both. Answer here; (a) becomes an R3 ticket at normal tier.

- 2026-09-23 — **Admin language.** The admin UI is Spanish (nav, headings,
  buttons) but the publish blockers ("Beskrivningen måste vara minst 80
  tecken…"), the admin form validation and some billing/upload messages are
  Swedish. Options: (a) translate them to Spanish (R3-43), (b) keep Swedish
  for you and stop there. Customer-facing text is already Spanish.

## Answered

- 2026-09-23 — **When does the free trial start?** (a) at publication —
  Anton asked for faster publishing (idea 15) on 2026-09-24. Built in
  growth-1: `startTrialAtPublish()` moves the trial window to the first
  publication day, same length, for manual and automatic publishing.

- 2026-09-14 — §7-synken (prompt-filerna mot §1.11–§1.13). **Klar.**
  `prompts/sonnet-7-category-lock.md` skriven från plan §6.5.
  `prompts/sonnet-3-theme-belleza.md`/`-4-theme-taller.md` ersatta med korta
  "CANCELLED"-stubbar (§1.12). `_handoff.md`, `_watcher.md`,
  `sonnet-6-link-pass.md`, `opus-3-ai-polish.md` uppdaterade till
  "S1, S2, S5, S7" / fyra teman. **Bake-off (§11.0) skiljs ut från denna
  fråga:** Anton valde (i sessionen, inte här) att köra S7 direkt på Opus utan
  Astra-jämförelse — §11.0 står kvar oförändrad i planen för framtida bruk,
  men gäller inte den här körningen av S7.

- 2026-09-13 — Price numbers: **Básico ₲ 300.000 / Plus ₲ 600.000 per year**
  (Anton). Pro stays reserved (₲ 900.000 suggested). Written into
  `docs/PLAN.md` §1.7 and `plan.md` §1.13; O2 prints it, S7 syncs
  `PLAN_SUGGESTED_PRICE_GS`.
