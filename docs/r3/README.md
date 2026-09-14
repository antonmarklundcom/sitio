# Round 3 — how to run a ticket

Round 3 follows `plan.md` §11 with one change decided by Anton on
2026-09-14: **every ticket runs on Codex `gpt-6-astra` at effort `low`**
(the manager-worker-codex skill's *normal* tier). No Opus sessions, no
*hard* tier unless a ticket fails twice at normal. Fable only in the window
Anton opens himself.

Codex CLI lives on Anton's PC, so dispatch happens there, not from a cloud
session. Per ticket:

1. `git checkout main && git pull`, then `git checkout -b r3/R3-<n>`.
2. Dispatch:

   ```powershell
   & "$env:USERPROFILE\.claude\skills\manager-worker-codex\scripts\codex-run.ps1" `
     -Repo "C:\path\to\sitio" -Tier normal -PromptFile "C:\path\to\sitio\docs\r3\prompts\R3-<n>.txt"
   ```

   Note the session id the script prints.
3. Revision gate: run the prompt's "Commands to run before reporting"
   yourself, `git diff --stat` against "Files to touch", read "Flagged or not
   done". Failure → resume the same session with the exact error text
   (`-Resume <id> -Tier normal`). Second failure at normal → new dispatch at
   `-Tier hard`.
4. Push, open one PR per ticket (body ≤ 15 lines, names the session id and
   the model/effort the script read from the log), merge when the pre-push
   hook is green.
5. Add the ticket's line to `docs/log/R3-1.md`.

Ticket sources, in order: `KNOWN-ISSUES.md` (written by S6), `plan.md` §10,
`docs/r3/inbox.md`.

## Batch 1

| Ticket | Prompt | Status |
|---|---|---|
| R3-0 AGENTS.md at repo root | none, done inline by the manager | done |
| R3-1 trim palettes to variants 1–2 | `prompts/R3-1.txt` | ready — dispatch after S6 has merged (S6 owns `palettes.ts` until then) |
| R3-2 … R3-5 | written from `KNOWN-ISSUES.md` once S6 has merged | pending S6 |
