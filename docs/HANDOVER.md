# Läge och nästa steg

> Skriven i slutet av sessionen som byggde PR-07 och PR-08. Läs den här filen
> först i nästa session, sedan `PLAN.md`.

## Var bygget står

| PR | Innehåll | Status |
|---|---|---|
| PR-01…PR-06 | Scaffold, datamodell, seed, superadmin-auth, businesses-CRUD, media-pipeline, publik rendering + tema `servicios` | Mergad (#3–#6) |
| **PR-07** | Teman `gastronomia` + `comercio`, fyra palettvarianter per tema, temaväljare med färgprover i admin, QA-gate med skärmdumpar | Mergad (#7) |
| **PR-08** | `/api/ev`-ingest, rollup till `analytics_daily`, adminstatistik, `npm run smoke` mot riktig MySQL | Mergad (#8) |
| **PR-09** | Prenumerationer, betalningsadmin, livscykel active→grace→expired, "Vencen pronto" | Mergad (#10) |
| **PR-10** | Intake med tokenad länk, tre steg, manuell WhatsApp-OTP | Mergad (#11) |
| **PR-11** | Owner-auth (WhatsApp-OTP), `/admin/accesos`, `/mi-sitio` med whitelistad redigering | Mergad (#13) |
| PR-12 → | Fas 2 fortsätter: moduler, radar | **Nästa** |

**Fas 1 är färdigbyggd** och fas 2 är påbörjad. Det som återstår innan första
betalande kund är deploy-steg A och B — infrastruktur, inte kod.

## Vad som nu ÄR verifierat mot en riktig databas

PR-08 installerade MySQL 8.0.46 i containern och körde igenom kedjan. Följande
är inte längre antaganden:

- Migreringarna applicerar rent på MySQL 8. (**Inte** på MariaDB — drizzles
  `serial AUTO_INCREMENT` är MySQL-syntax. Testa aldrig lokalt med MariaDB.)
- Seed, inloggning, sajtlistan, CRUD, ISR-invalidering vid write, slug-byte med
  permanent redirect, preview-token giltig och ogiltig.
- Bilduppladdning genom sharp, lagring i `UPLOADS_DIR` och servering via
  `/media/...` med `immutable`-cache.
- Analytics-ingesten: botklassning, rate limit (exakt 120/min), avvisning av
  opublicerade sajter och okända eventtyper, rollup med botfiltrering,
  prunning vid 13 månader.
- Betalningarnas livscykel (PR-09): respit håller sajten uppe, förfall pausar
  den (404 + ur sitemap), andra körningen är en no-op, bekräftad betalning
  publicerar den igen med ISR-cachen invaliderad.
- Hela intake-flödet (PR-10) inklusive behörighetsgränser: uppladdning utan
  token nekas (401), kvittouppladdning med intake-token nekas (403), fel OTP
  avvisas, inlämning stänger länken (404) och sajten hamnar i granskningskön.
- Owner-flödet (PR-11): OTP-login, neutralt svar för okänt nummer, owner
  blockeras från `/admin`, ändring slår igenom på publika sajten via ISR, och
  en owner som postar ett främmande `businessId` skriver ändå till sin egen
  sajt.

Röktestet är nu 46 kontroller. Kör det efter varje PR som rör admin, intake,
betalningar, owner-panelen eller uppladdning. Två körningar tätt inpå varandra
slår i inloggningens rate limit (5 försök / 15 min, per process) — starta om
servern mellan körningarna.

Kör om det när som helst med `npm run smoke` (se README). Testet skriver i
databasen — aldrig mot produktion.

## Vad som fortfarande INTE är verifierat

Allt nedan kräver Hostinger och kan inte mätas härifrån:

1. **Uploads-persistens över redeploy.** Avgör om R2-flytten (PR-21) måste
   tidigareläggas till fas 1. Testet står i README, avsnittet
   "Uploads-persistens".
2. **Databasens tidszon.** Rollupens dygnsgräns är databasklockan +
   `ANALYTICS_TZ_OFFSET_HOURS` (default −3). Kör `select now(), utc_timestamp();`
   på Hostinger-databasen. Skiljer de sig är den inte i UTC och offseten ska
   justeras — annars hamnar kvälls- och nattbesök på fel dygn.
3. **Att hPanel-cron når `/api/cron/rollup`.** Lazy-fallbacken täcker upp, men
   då uppdateras siffrorna först när du öppnar adminet.
4. **Byggtid och minne på Hostinger-noden.** `next build` här tar ~40 s.

## Nästa session: PR-12 (modul-infra + gallery)

1. **`business_modules`-admin**: slå på/av moduler per kund. Tabellen finns,
   `businessModules` läses redan av `getSiteBySlug()` och skickas till temana
   som `modules: Set<string>` — temana renderar alltså redan villkorat.
   `servicios` och `gastronomia` respekterar `gallery` för fotoantalet, och
   `/api/upload` höjer fototaket från 8 till 20 när modulen är på.
2. **Gallery-modulen i owner-vyn**: owner ska kunna sortera sina foton, inte
   bara byta huvudbild. `moveMediaAction` i adminets `media-actions.ts` har
   mönstret (skriv om hela ordningen, byt inte två sortOrder-värden).
3. Bygg vidare på mönstret från PR-11: whitelist i `src/lib/owner-form.ts`,
   tenant ur sessionen, aldrig ur formuläret.
4. Utöka `npm run smoke` (46 kontroller i dag) och kör mot en lokal MySQL innan
   PR:en stängs. Så här sätter du upp den i en tom container:

   ```bash
   apt-get update -qq && apt-get install -y -qq mysql-server
   mkdir -p /var/lib/mysql-files /var/run/mysqld && chown mysql:mysql /var/lib/mysql-files /var/run/mysqld
   mysqld --initialize-insecure --user=mysql && mysqld --user=mysql --daemonize
   mysql -uroot -e "create database sitio character set utf8mb4;
     create user 'sitio'@'127.0.0.1' identified by 'sitio-dev';
     grant all on sitio.* to 'sitio'@'127.0.0.1';"
   ```

   Sedan `.env.local` med `DATABASE_URL=mysql://sitio:sitio-dev@127.0.0.1:3306/sitio`,
   `npm run db:migrate && npm run db:seed`. (MariaDB duger inte — drizzles
   `serial AUTO_INCREMENT` är MySQL-syntax och migreringarna faller.)

Regler som gäller oförändrat: inga filer under `.github/workflows/`, noll
hårdkodade absolut-URL:er, spanska (voseo) i kund-UI och svenska i superadmin,
varje mutation bakom `requireRole()` + tenant-filter, och QA-gaten
(`theme:preview` + `theme:shots`) före varje temaändring.

## Kända skavanker (inte buggar som blockerar något)

- Superadmin som öppnar `/mi-sitio?sitio=<id>` kan läsa kundvyn men inte spara:
  mutationerna kräver en owner-session med `businessId`. Medvetet — superadmin
  redigerar i `/admin`, där ändringarna loggas mot rätt aktör.
- Öppettider i intaken tar ett intervall per dag. Delade pass (siesta) är
  vanliga i Paraguay och läggs till i admin efteråt — ett stegformulär på mobil
  tål inte fyra tidsfält per dag.
- Kunden kan inte ta bort en uppladdad bild själv under intake, bara lägga
  till. Fototaket (8) stoppar värsta fallet, och du städar i admin.

- `media.width` / `height` sparar originalets mått, inte variantens. Spelar
  ingen roll för loggan (renderas med max-height) men bör städas när
  owner-admin (PR-11) börjar visa bildmått.
- Inloggningens rate limit (5 försök / 15 min) är per process. Slår du i den
  under lokal testning: starta om servern.
- Slug-redirect svarar 308, inte 301. Google behandlar dem lika.

## Vad du gör själv, utanför Claude

1. **Välj Hostinger-slot** för sitio.com.py och säg vilken det blir. Jag behöver
   veta: kontonamn/slot, om det finns en ledig Node.js-app-plats, och vilken
   temp-domän (`*.hostingersite.com`) den får.
2. **Skapa databasen i hPanel** och ge mig värdena — eller sätt dem själv i
   hPanel: `DATABASE_URL` (localhost-varianten för noden),
   `NEXT_PUBLIC_BASE_URL` (temp-domänen), `SESSION_SECRET`
   (`openssl rand -base64 48`), `CRON_SECRET` (`openssl rand -hex 32`),
   `UPLOADS_DIR` (`/home/<user>/uploads/sitio`).
3. **Vitlista din IP** under Remote MySQL om du vill köra migreringarna
   lokalt (det är så README säger att det ska gå till).
4. **Skapa uploads-katalogen via SSH:** `mkdir -p /home/<user>/uploads/sitio`.
   Den måste ligga utanför appkatalogen — git-deployen skriver om den.
5. **Lägg upp cron-jobbet** i hPanel, en gång per dygn:
   `curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://<domän>/api/cron/rollup`
6. **Registrera sitio.com.py** när du är redo för steg B. Domänen är ännu inte
   registrerad, och en ny .com.py rankar långsamt — ju tidigare desto bättre.
7. **Kör uploads-persistenstestet** efter första deployen (README). Svaret
   avgör om PR-21 måste tidigareläggas.

När 1–2 är klara kan jag göra resten av deploy-steg A.
