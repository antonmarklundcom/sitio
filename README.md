# sitio.com.py

Foot-in-the-door-SaaS för paraguayanska småföretag: en WhatsApp-first one-page-sajt
på `sitio.com.py/[slug]`. Se [`docs/PLAN.md`](docs/PLAN.md) för produkt- och byggplan,
[`docs/RUNNER-POLICY.md`](docs/RUNNER-POLICY.md) för CI-/minutpolicyn.

## Stack

| Lager | Val |
|---|---|
| App | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS 4 |
| DB | MySQL (Hostinger) via Drizzle ORM + `mysql2` |
| Sessioner | `iron-session` (cookie-baserad, ingen extern session-store) |
| Bilder | `sharp` → webp-varianter, lagrade i `UPLOADS_DIR` **utanför** repot |
| Deploy | Hostinger managed Node.js, GitHub-import + webhook. **Inga GitHub Actions.** |

## Kom igång lokalt

```bash
npm install
cp .env.example .env.local          # fyll i DATABASE_URL m.m.
npm run db:push                     # eller: npm run db:migrate
npm run db:seed                     # superadmin + 3 demo-företag
npm run dev
```

Seedens inloggning styrs av `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
(default `anton@sitio.com.py` / `sitio-dev-1234`). Byt lösenordet innan produktion.

## Miljövariabler

Alla finns dokumenterade i [`.env.example`](.env.example). De kritiska:

| Variabel | Roll |
|---|---|
| `DATABASE_URL` | MySQL. Lokalt: Remote MySQL-värden. På Hostinger: **localhost**-varianten. |
| `NEXT_PUBLIC_BASE_URL` | **Enda** stället där domänen finns. Domänbyte = env-ändring, aldrig refaktorering. |
| `SESSION_SECRET` | ≥32 tecken. `openssl rand -base64 48` |
| `CRON_SECRET` | Skyddar rollup-/livscykel-routen mot publika anrop. |
| `ANALYTICS_TZ_OFFSET_HOURS` | Valfri. Databasklocka → Asunción-dygn i rollupen. Default −3 (förutsätter UTC). |
| `UPLOADS_DIR` | Absolut sökväg **utanför** deploy-trädet, t.ex. `/home/<user>/uploads/sitio`. |

### Regeln som gäller från PR-01

**Noll hårdkodade absolut-URL:er.** Allt går via `baseUrl()` / `absoluteUrl()` i
`src/lib/env.ts`. Det gäller `generateMetadata` (canonical, og:url), JSON-LD
`LocalBusiness.url`, `sitemap.xml`, `robots.txt`, preview-token-länkar och
wa.me-pitchlänkar i admin.

## Databas

```bash
npm run db:generate   # skapa migrering från src/db/schema.ts
npm run db:migrate    # applicera migreringar
npm run db:push       # snabbsynk under utveckling
npm run db:studio     # drizzle studio
```

`drizzle-kit` laddar `.env` själv. **`tsx` gör det inte** — därför importerar
`scripts/*.ts` `src/lib/env.ts` först av allt, som laddar `.env.local` + `.env`.

DB-init mot Hostinger körs **lokalt** via Remote MySQL (IP måste vitlistas i
hPanel), inte på noden.

## CI och git-hooks

Repot har **inga** `.github/workflows/`, medvetet — se `docs/RUNNER-POLICY.md`.
Kontrollerna körs som git-hooks istället:

- `.husky/pre-commit` — blockerar commits som lägger till filer under `.github/workflows/`.
- `.husky/pre-push` — `typecheck && lint && build`. Röd build = blockerad push.

Hookarna går att kringgå med `--no-verify`; de är en ledstång, inte en mur.

## Analytics

Beaconen i kundsajternas layout postar till `POST /api/ev` (bara på publicerade
sajter — förhandsvisningar räknas aldrig). Ingesten:

- klassar user agent som `mobile` / `desktop` / `bot` / `unknown`. Bots lagras
  men räknas aldrig in i siffrorna — att kasta dem vid ingest hade gjort det
  omöjligt att se om en sajt bara får bottrafik.
- lagrar `visitorHash = sha256(ip + ua + dagsalt)` trunkerad till 32 tecken.
  Saltet härleds ur `SESSION_SECRET` + dagens datum, lagras aldrig och roterar
  vid midnatt: hashen går inte att koppla mellan två dygn och databasen går
  inte att baklängesräkna till IP-adresser.
- rate-limitar 120 event per IP och minut, svarar alltid `204` (en
  differentierad statuskod hade gjort endpointen till en id-uppräknare).

`analytics_events` rullas upp till `analytics_daily` av
`GET /api/cron/rollup` (hPanel-cron, `Authorization: Bearer $CRON_SECRET`).
Sätts cron aldrig upp gör lazy-fallbacken samma jobb vid första adminläsningen
per dygn — routen är en optimering, inte en förutsättning. Råevent prunas efter
13 månader. Aggregatet är idempotent: samma dygn kan rullas upp hur många
gånger som helst.

Dygnsgränsen räknas som databasens klocka + `ANALYTICS_TZ_OFFSET_HOURS`
(default −3). `CONVERT_TZ` med namngivna zoner kräver MySQL:s tz-tabeller, som
sällan är laddade på delad hosting. **Verifiera vid deploy-steg A:**
`select now(), utc_timestamp();` — skiljer de sig är databasen inte i UTC och
offseten måste justeras.

## Teman

Ett tema = en komponent (`src/themes/<key>/<key>-theme.tsx`), en CSS-fil med
sektionsmönstren, och fyra palettvarianter i `src/themes/palettes.ts`. Byggda:
`servicios` (INDUSTRIAL), `gastronomia` (WARM CRAFT), `comercio` (EDITORIAL).
Övriga tre faller tillbaka på `servicios` tills PR-15 — admin visar det i
temaväljaren i stället för att låtsas att valet gäller.

Delade sektionsprimitiv (öppettidslista, adressrad, footer, statusprick) ligger
i `src/themes/theme.css`; temafilen innehåller bara temats egna mönster.
Ljusa teman bär `.t-light` på roten — den tonar ner skuggor och grain, som
annars är satta för mörkdominant design.

QA-gaten före varje temaändring:

```bash
npm run theme:preview     # .preview/<tema>-v<1..4>.html med demodata
npm run theme:shots       # skärmdumpar i 360/768/1280 + överflödeskontroll
```

`theme:shots` serverar `.preview/` över HTTP (bild-src är rotrelativa), väntar
in reveal-animationen och felrapporterar horisontell scroll per bredd. Den
fångade fyra riktiga buggar i PR-07: statement-rubriken sprängde 360 px,
karusellerna sköt ut hela sidan via `min-width: auto`, hero-texten hamnade
ovanpå kontaktpanelen på desktop, och galleriet renderade tomt.

## Prenumerationer och betalningar

Manuellt bekräftade, ingen Stripe (PLAN.md §1.7). Du säljer på WhatsApp, skapar
prenumerationen i `/admin/sitios/<id>`, registrerar betalningen när kunden
skickar comprobante, och bekräftar den när pengarna syns.

Registrering och bekräftelse är **två steg med flit**: det första skriver ner
vad kunden säger, det andra förlänger perioden. Slås de ihop förlänger ett
slarvigt klick ett år.

Livscykeln räknas ut, aldrig gissas:

| Läge | Vad som händer |
|---|---|
| `active` | Betald. Sajten uppe. |
| `grace` | Förfallodatum passerat. **15 dagar**, sajten står kvar uppe. |
| `expired` | Respiten slut ⇒ sajten sätts till `paused`: 404 + noindex, datat kvar. |
| bekräftad betalning | Perioden förlängs till betalningens periodslut. En sajt som pausats för utebliven betalning publiceras igen. |

Steget körs av `/api/cron/rollup` i samma nattliga anrop som analytics-rollupen.
Det har medvetet **ingen** lazy fallback — det ändrar status på sajter och får
inte hända som sidoeffekt av en läsning. Saknas cron kör du det manuellt med
knappen "Kör förfallokontroll nu" i `/admin/pagos`.

`/admin/pagos` är arbetsvyn: kön av betalningar att bekräfta, och "Vencen
pronto" (≤45 dagar) med en wa.me-länk per kund vars meddelande innehåller
årets siffror — *"Tu página tuvo 340 visitas y 52 contactos por WhatsApp este
año 📈"*. Saknas trafik utelämnas siffrorna hellre än att skönmålas.

## Intake (onboarding av ny kund)

Superadmin skapar utkast + länk i `/admin/alta`, delar den via WhatsApp, och
kunden fyller i själv på `/alta/<token>` — tre steg: **datos → fotos →
verificación**. Länken gäller 14 dagar och stängs när formuläret skickas in.

- Utkastet finns i databasen redan när kunden öppnar länken. Varje fält kunden
  fyller i uppdaterar en rad du kan se, i stället för att leva i webbläsaren
  tills allt skickas.
- Kundens råtext sparas i `rawDescription` och publiceras **aldrig** oredigerad;
  `description` sätts av dig i admin (ev. med AI-puts).
- Uppladdning under intake går genom samma `/api/upload` som adminet, men
  auktoriseras av token i stället för session. Token bestämmer själv vilket
  business bilden hamnar på — ett `businessId` i formuläret ignoreras — och
  bara `photo` och `logo` släpps igenom, aldrig `receipt`.
- **OTP:** koden genereras av dig i `/admin/alta` och visas **en gång**. Bara
  hashen lagras (HMAC med `SESSION_SECRET`), så en tappad kod ersätts av en ny
  — den går inte att läsa upp. Du skickar den från din egen WhatsApp tills
  Cloud API finns (PR-17). Koden lever 10 minuter och tål fem försök.
- Byter kunden WhatsApp-nummer nollställs verifieringen. Ett verifierat nummer
  ska inte kunna bytas mot ett obekräftat efter godkännandet.
- Inlämning kräver beskrivning, två tjänster, verifierat nummer och minst en
  bild ⇒ status `pending_review` och länken stängs.

Okänd, utgången och redan inskickad token ger alla samma 404 — sidan får inte
gå att använda för att gissa fram giltiga länkar.

## Röktest mot riktig databas

`npm run smoke` kör en riktig genomgång med Playwright mot en byggd app och en
riktig MySQL: inloggning, sajtlistan, statistikpanelen, CRUD med
ISR-invalidering, slug-byte med permanent redirect, preview-token (giltig och
ogiltig), bilduppladdning genom sharp och ut via `/media`, prenumeration →
betalning → bekräftelse → förlängd period, hela intake-flödet med OTP
(inklusive att uppladdning utan token nekas), samt beaconen.

```bash
npm run db:migrate && npm run db:seed
npm run build && PORT=3100 npm run start &
SMOKE_BASE_URL=http://127.0.0.1:3100 npm run smoke
```

**Testet skriver i databasen** (byter namn och slug på business 1, laddar upp
en bild). Kör det aldrig mot produktion.

Kört mot MySQL 8.0.46 i PR-08 — första gången något i repot testats mot en
faktisk databas. Det fångade två riktiga fel: en korrelerad subfråga i
sajtlistan där drizzle renderade `${businesses.id}` okvalificerat, så att varje
subfråga jämförde med sin EGEN id-kolumn (alla sajter fick samma statistik och
fel betalstatus), och att `drizzle-kit` inte läser `.env.local` — den fil
README säger åt dig att skapa.

Utöver röktestet är betalningarnas livscykel verifierad mot databasen i PR-09:
respit håller sajten uppe, förfall pausar den (404 + ur sitemap), en andra
körning är en no-op, och en bekräftad betalning publicerar den igen.

Kvar att verifiera mot Hostinger (kan inte testas här): uploads-persistens över
redeploy, databasens tidszon, och att hPanel-cron faktiskt når rollup-routen.

## Deploy till Hostinger

### Steg A — temp-domän (första deploy, efter PR-06)

1. hPanel → **Node.js App** → Import Git Repository → branch `main`.
2. Build: `npm ci && npm run build`. Start: `npm run start`. Node 20+.
3. Sätt env-varsen ovan i hPanel. `NEXT_PUBLIC_BASE_URL` = Hostingers
   `*.hostingersite.com`-adress till att börja med.
4. Skapa `UPLOADS_DIR` via SSH: `mkdir -p /home/<user>/uploads/sitio`.
   Katalogen **måste** ligga utanför appkatalogen — git-deployen skriver om den.
5. Kör migreringarna lokalt mot Remote MySQL, inte på noden.

Temp-domänen är för intern validering. **Ingen kund får någonsin en temp-URL.**

### Steg B — riktig domän (före första betalande kund)

1. A-record `sitio.com.py` + `www` → slottens IP.
2. Peka appens domän till `sitio.com.py` i hPanel, låt SSL utfärdas.
3. `NEXT_PUBLIC_BASE_URL=https://sitio.com.py`, starta om appen.
4. Verifiera canonical, og:url, JSON-LD `url`, `sitemap.xml`, `robots.txt`,
   preview-länkar och wa.me-länkar i admin.
5. 301 från temp-adressen om den hunnit indexeras.

### Bildpipelinen

Uppladdning sker via `POST /api/upload` (auth + tenant-check + max 10 MB +
mime-whitelist). `sharp` bakar in EXIF-orienteringen, **strippar EXIF**, och
skriver varianterna 400 / 800 / 1600 px som webp (kvalitet 78). Loggan blir i
stället 256 px PNG med bevarad transparens. Originalet sparas aldrig.

Filnamnet innehåller en hash av innehållet, så en utbytt bild får en ny URL —
det är därför serverings-routen `/media/[businessId]/[file]` kan skicka
`Cache-Control: public, max-age=31536000, immutable` utan risk.

`next/image` används **inte** för kundbilder. Vi servar färdiga varianter med
`<img srcset>`; Hostinger-managed har ingen bra cache-story för image-optimizern.

Verifierat lokalt: orienteringen roteras rätt, EXIF försvinner, varianterna får
rätt dimensioner, loggan behåller alfakanalen, och `resolveMediaPath()` blockerar
`../`, snedstreck i filnamn och manipulerat `businessId`.

### Uploads-persistens

Frågan "överlever `UPLOADS_DIR` en redeploy?" kan bara besvaras mot faktisk
Hostinger-miljö. Testet körs vid deploy-steg A:

1. Ladda upp en bild via `/admin`, verifiera att den serveras på `/media/…`.
2. Trigga en redeploy via GitHub-webhooken.
3. Anropa samma `/media/…`-URL igen.

**Status:** ⬜ inte testat ännu — kräver deploy-steg A. Själva pipelinen
(upload → sharp → disk → `/media`-servering med immutable-cache) är däremot
verifierad mot en riktig databas och ett riktigt filsystem, se röktestet ovan.

Svaret avgör om R2-flytten (PR-21) måste tidigareläggas till fas 1. Ligger
`UPLOADS_DIR` utanför appkatalogen bör den överleva, men det är en antagelse
tills den är mätt.

## Katalogstruktur

```
src/
  app/            # App Router: /[slug] (kundsajter), /admin, /alta, /api
  db/             # schema.ts (auktoritativt), index.ts (pool)
  lib/            # env, auth/session, slug, formatering, media
  components/     # admin-UI (formulär, mediahanterare, primitiver)
  themes/         # ett tema per katalog + delad theme.css och palettregister
drizzle/          # genererade migreringar
scripts/          # tsx-scripts (seed, temaförhandsvisning, QA-skärmdumpar)
docs/             # PLAN.md, RUNNER-POLICY.md
```
