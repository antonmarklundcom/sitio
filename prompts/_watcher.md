# Watcher — hourly Sonnet Routine. Do not build. Do not answer design questions.

Read ONLY: `plan.md` phase table and §9, `docs/decisions-needed.md`, and the git
and PR state. Finish within a few minutes.

1. For each lane 2 phase (S1–S5) decide its state:
   - **merged**: PR merged (line in §9, or the PR list shows merged).
   - **running**: branch `phase/<id>` has a commit less than 90 minutes old
     and the PR is not merged.
   - **stalled**: branch exists, newest commit older than 90 minutes, PR not
     merged (or PR green but unmerged for > 30 minutes).
   - **not started**: no branch.
2. Actions, while fewer than 4 phases are running:
   - stalled → re-spawn it (`create_session`, `model` `claude-sonnet-5`,
     prompt `Read prompts/<file>.md in this repo and execute it.`). Prompts
     are re-runnable.
   - not started → spawn it, same call.
   - PR green and mergeable but its session is gone → merge it, add the §9
     line if missing.
3. When S1–S5 are all merged and `phase/S6` does not exist → spawn S6
   (`prompts/sonnet-6-link-pass.md`, Sonnet).
4. Read `docs/decisions-needed.md`. If it has entries without an answer, send
   Anton a push notification with the questions verbatim (PushNotification
   tool if available, otherwise leave a clear line in this Routine's output).
5. Count your own firings from the Routine's run history. On the 12th firing
   with the build still not done, disable the Routine (`update_trigger`
   `enabled: false`) and notify Anton.

Never edit code, never message a running session, never use Fable.
