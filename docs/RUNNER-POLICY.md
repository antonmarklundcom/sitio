# GitHub Actions-minuter — policy och åtgärdsplan

> Kontonivå-dokument. Gäller alla repon under `antonmarklundcom`, inte bara sitio.
> Gällande skill: **`budgeted-runner-deploy`**. `zero-runner-deploy` är avvecklad
> (ta bort den i skill-hanteringen på claude.ai — den triggar på samma nyckelord
> och konkurrerar annars om varje scaffold-beslut).

---

## 1. Målet

Minska förbrukade Actions-minuter med **~80 %** mot senaste veckan, utan att
förlora vare sig Claude-assisterad utveckling eller deploy-automation.

Minuter debiteras **per konto**, inte per repo, och **fria minuter gäller bara
privata repon** — publika repon kör obegränsat gratis på standardrunners.
Därför är förbrukningen osynlig tills kvoten är slut: det är sällan en katastrof,
det är femton repon som tyst kör tre minuter per push.

## 2. Var minuterna faktiskt går

Rangordnat efter förväntad besparing.

| # | Källa | Varför det kostar | Åtgärd |
|---|---|---|---|
| 1 | **`@claude` i PR/issue** (claude-code-action) | Kör i ditt eget repo på `ubuntu-latest`. Hela kodningssessionen debiteras dig — 5–20 min per anrop — och varje uppföljningskommentar startar en ny körning | Använd Claude Code på **webben/desktop** istället. De sessionerna kör i Anthropics moln = **0 GitHub-minuter** |
| 2 | **Copilot code review** på privata repon | Konsumerar Actions-minuter per PR | Stäng av på privata repon |
| 3 | **Scaffold-workflows i gamla repon** | 3 min × varje push × antal repon | Settings → Actions → General → **Disable actions** per repo som inte behöver CI |
| 4 | **`on: push` + `on: pull_request` samtidigt** | Dubbelbetalar varje commit på en PR-branch | Ta bort `push` |
| 5 | **Matris-jobb** | Varje jobb rundas upp till hel minut: 5 jobb × 40 s = 5 min, inte 3,5 | ETT jobb |
| 6 | **Saknad `timeout-minutes`** | Default är 360 min. Ett hängt jobb = ~18 % av en 2000-minutersmånad | Alltid `timeout-minutes: 10` |

Punkt 1 ensam står sannolikt för merparten av förbrukningen. Den är också
gratis att åtgärda — samma arbete, annan körplats.

## 3. Alternativ till GitHub-hostade runners

Rangordnat efter avkastning. Stanna vid det första som räcker.

1. **Publikt repo** — obegränsade gratis minuter på standardrunners. Fungerar för
   varje repo utan hemligheter eller kunddata i koden (sitio kvalificerar: allt
   känsligt ligger i Hostingers env-vars, aldrig i git). Kostar 0, tar 30 sekunder.
2. **Web-/desktop-sessioner istället för `@claude`-i-PR** — 0 minuter, samma arbete.
3. **Self-hosted runner på Hostinger-VPS** — GitHub debiterar 0 för self-hosted.
   Relevant först om riktig CI behövs utan tak.
4. **Hostinger-webhook för deploy** — redan vår deploy-väg. Webhooks är gratis och
   omätta; de är inte Actions och syns aldrig i Actions-fakturan.
5. **Byta värd** (GitLab 400 min, Codeberg, Bitbucket 50 min) — **rekommenderas ej.**
   Du förlorar Claude-integrationen och Hostingers GitHub-import för en vinst som
   punkt 1–2 ger gratis.

## 4. Engångsåtgärder (klickas en gång, av dig)

- [ ] Ta bort skillen `zero-runner-deploy` på claude.ai (annars dubbel-triggning)
- [ ] Billing → **spending limit `$0`** — hård vägg, kan aldrig debiteras en cent.
      Körningar blockeras resten av månaden istället. (`$10` bara om CI måste
      överleva en överdragning.)
- [ ] Sluta använda `@claude` i PR-kommentarer; kör web-sessioner
- [ ] Stäng av Copilot code review på privata repon
- [ ] Gå igenom alla repon: Settings → Actions → General → Disable actions på varje
      repo utan CI-behov
- [ ] Gör `sitio` publikt (om inga hemligheter i historiken) — gör Actions gratis
      för repot oavsett vad som händer sen
- [ ] Sätt en månatlig påminnelse: Settings → Billing → Actions bryter ner
      förbrukningen **per repo** — det är så du hittar repot som faktiskt läcker

## 5. Regler i kod (gäller detta repo)

`.husky/pre-push` — ersätter CI, snabbare än CI (varm `node_modules`, varm `.next/cache`):

```sh
npm run typecheck && npm run build || {
  echo "Build failed — push blocked."; exit 1;
}
```

`.husky/pre-commit` — hindrar en över-ivrig agent från att smyga in CI:

```sh
if git diff --cached --name-only | grep -q '^\.github/workflows/'; then
  echo "BLOCKED: workflows kräver Antons uttryckliga godkännande (budgeted-runner policy)."
  exit 1
fi
```

Hooken går att kringgå med `--no-verify` och skyddar bara maskiner där husky är
installerad. Det är en ledstång, inte en mur — punkt 4 är muren.

## 6. Om en workflow någon gång godkänns

Formen är låst. En avvikelse och besparingen är borta.

```yaml
on:
  pull_request:                      # aldrig också on: push — dubbelbetalar
    paths-ignore: ['**.md', 'docs/**', '.vscode/**']

concurrency:                         # största enskilda besparingen när en agent
  group: ci-${{ github.ref }}        # pushar många commits i rad: ersatta
  cancel-in-progress: true           # körningar dör istället för att köra klart

jobs:
  check:                             # ETT jobb. Ingen matris — avrundning per jobb.
    runs-on: ubuntu-latest           # aldrig macos (10x) eller windows (2x)
    timeout-minutes: 10              # ärv aldrig 360-minutersdefaulten
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck && npm run lint && npm test && npm run build
```

`cancel-in-progress` får **aldrig** sitta på ett jobb som skriver till server
eller databas — en avbruten deploy lämnar ett halvskrivet filsystem.
