# Phase O3 — AI polish ("Pulir textos"). Opus session. Lane 1 (last).

Read ONLY: this file, `plan.md` (phase table, §1 esp. 1.5, §4, §5.3, §9),
`docs/log/O1.md`, `docs/PLAN.md` §1.4 and D7, `src/app/admin/(dashboard)/sitios/[id]/page.tsx`,
`src/app/admin/(dashboard)/sitios/actions.ts` (for the action pattern),
`src/lib/env.ts`. Execute under plan §4. Build nothing outside §5.3.

Owns: `src/lib/ai-polish.ts`, `src/app/admin/(dashboard)/sitios/polish-actions.ts`,
`src/components/admin/polish-panel.tsx`, `tests/unit/ai-polish.test.ts`,
`tests/smoke/polish.mjs`, `package.json`/lockfile (add `@anthropic-ai/sdk`),
`.env.example` (append `AI_POLISH_MODEL`), `src/lib/env.ts` (two getters),
`src/app/admin/(dashboard)/sitios/[id]/page.tsx` (mount the panel, one block),
`docs/log/O3.md`.

Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn.

Phase rules:
- Branch `phase/O3` off latest `main`. WIP commit every 30 min.
- Load skill `claude-api` FIRST and follow its TypeScript README for the SDK
  call: `client.messages.create` with `output_config: { format: {...} }`
  (JSON schema), model from `env.aiPolishModel` (default `claude-opus-5`),
  `max_tokens` 4000, no prefill, check `stop_reason` before reading content.
  Do not write the request from memory.
- Server action only. Never call the API during render or in ISR paths.
- The proposal is stored in `activity_log` (`ai_polish_proposed`, meta = the
  four fields + usage) and read back for the panel, so a reload keeps it.
  "Aplicera" writes only the checked fields, sets `aiPolishedAt`, logs
  `ai_polish_applied`, `revalidateTag('biz:<slug>')`. `rawDescription` is
  never written.
- Guardrails in the system prompt (plan §5.3.1) and in code: clamp/reject
  over-length fields; reject if the model returns a service count different
  from the input.
- No key ⇒ panel renders "ANTHROPIC_API_KEY saknas i miljön" with the button
  disabled. This is the state smoke tests can exercise; test it.
- If you have a key locally, run one real polish on the seeded
  "Electricidad" business and paste the before/after in the PR body (≤ 25
  lines total). If not, say so in the log; do not fake it.
- Re-runnable; minor issues → `docs/log/O3.md`; stop only per §4.4.

Exit:
- `npm test` green with the ai-polish tests (prompt builder, diffFields,
  length validation, service-count guard).
- `tests/smoke/polish.mjs`: panel shows the no-key state when the env var is
  unset; green.
- Pre-push green, PR merged, `docs/log/O3.md`, §9 line.

## After this phase
Follow `prompts/_handoff.md` "Last lane 1 phase": create the watcher Routine,
then spawn S1, S2, S5 (`prompts/sonnet-1-products.md`,
`prompts/sonnet-2-theme-salud.md`, `prompts/sonnet-5-radar.md`), model Sonnet,
and S7 (`prompts/sonnet-7-category-lock.md`), model Opus (bake-off, plan
§11.0). S3 and S4 are cancelled; do not spawn them.
