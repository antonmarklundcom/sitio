# Phase handoff — read when your phase's exit criteria pass

Four gates, in order. Do not spawn anything before all four:

1. PR merged green into `main` (the pre-push hook is the CI; a red hook is your
   work). Merge with the repo's default (squash is fine).
2. Exit checklist in your prompt passed, each item verified, not assumed.
3. Pre-handoff audit: ONE re-run of `npm run typecheck && npm run lint && npm test
   && npm run build` on `main`, ONE adversarial re-read of the merged diff.
   Findings fixed in ONE follow-up commit on `main` via a tiny PR, or logged in
   `docs/log/<id>.md` if not blocking. No second round.
4. `docs/log/<id>.md` committed (format: plan §4.11) and the index line added
   to `plan.md` §9.

Then, by lane:

**Lane 1 (O1, O2):** spawn the next lane 1 phase with `create_session`
(claude-code-remote MCP): inherit environment, inherit permission mode (never
`plan`), `model` set explicitly per the phase table (Opus id from the
`claude-api` skill: `claude-opus-5`), `source_url` this repo, `prompt` exactly:
`Read prompts/<next-file>.md in this repo and execute it.`
If `create_session` is unavailable (local CLI), continue in this window with
the next prompt since the model is the same.

**Last lane 1 phase (O3):**
1. Create the watcher Routine with `create_trigger`: `cron_expression`
   `0 * * * *` (hourly), `create_new_session_on_fire: true`, `model`
   `claude-sonnet-5`, `name` `sitio watcher`, `prompt` exactly
   `Read prompts/_watcher.md in this repo and execute it.`,
   `initiation` `human_schedule`.
2. Spawn S1, S2, S5 at once with `create_session` (`model`
   `claude-sonnet-5`, same rules as above, prompt `Read prompts/<file>.md in
   this repo and execute it.`), and S7 with `model` `claude-opus-5` (one-off
   bake-off, plan §11.0). S3 and S4 are cancelled (plan §1.12): never spawn
   them. If `create_session` is unavailable, stop and report: the next
   phases run in fresh windows, one per prompt file.

**Lane 2 (S1, S2, S5, S7):** spawn nothing. End with the phase report.

**Link pass (S6):** delete the watcher Routine (`list_triggers` →
`delete_trigger`), then STOP with the closing report.

Never use Fable for any of the above (plan §4.8).
