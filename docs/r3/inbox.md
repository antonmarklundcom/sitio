# Round 3 inbox

One line per item, free form. The manager turns lines into R3-<n> tickets
(plan.md §11.2). Workers never commit "while I was there" findings; they go
here.

- 2026-09-14 (manager, found during R3-5 audit) — `scripts/smoke-e2e.mjs` is not re-runnable against the same database: its menu-module steps assume the seeded state (menu off, no items, original slug), so a second `npm run smoke` without a fresh migrate+seed fails at "menyn syns inte utan modulen" and the following menu checks, independent of the shared login. Reproduced with the pre-R3-5 helper. Fix candidate: make the e2e reset or create its own menu fixture, or have `_run.mjs` document that a fresh seed is required.
- 2026-09-14 (manager) — the Codex sandbox on the PC cannot run `tsx` scripts (uv_os_get_passwd ENOMEM) nor reach MySQL; theme:preview and db:seed steps in prompts must be marked as manager-run.
