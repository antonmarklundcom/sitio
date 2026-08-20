# Läge och nästa steg

> Skriven i slutet av sessionen som byggde PR-07 och PR-08. Läs den här filen
> först i nästa session, sedan `PLAN.md`.

## Var bygget står

| PR | Innehåll | Status |
|---|---|---|
| PR-01…PR-06 | Scaffold, datamodell, seed, superadmin-auth, businesses-CRUD, media-pipeline, publik rendering + tema `servicios` | Mergad (#3–#6) |
| **PR-07** | Teman `gastronomia` + `comercio`, fyra palettvarianter per tema, temaväljare med färgprover i admin, QA-gate med skärmdumpar | Mergad (#7) |
| **PR-08** | `/api/ev`-ingest, rollup till `analytics_daily`, adminstatistik, `npm run smoke` mot riktig MySQL | Mergad (#8) |
| PR-09 | Subscriptions + payments-admin | **Nästa** |
| PR-10 | Intake + WhatsApp-verifiering (manuell OTP) | Efter PR-09 |
| PR-15 | Teman `salud`, `belleza`, `taller` | Fas 2 |

Fas 1 är klar efter PR-09 och PR-10. Deploy-steg A kan göras när som helst —
det hänger inte på dem.

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

## Nästa session: PR-09 (subscriptions + payments-admin)

Allt finns redan i schemat (`subscriptions`, `payments`) — inga migreringar.

1. Serveråtgärder bakom `requireRole("superadmin")`: skapa prenumeration
   (plan, pris i heltals-Gs, `startsAt`, `expiresAt` = +1 år), registrera
   betalning (metod, referens, kvittobild via befintlig media-pipeline med
   `kind: "receipt"`), bekräfta/avvisa. Bekräftelse förlänger `expiresAt`.
2. Statusmaskineri `active → grace → expired → paused`. Lägg dagssteget i
   `/api/cron/rollup` — routen finns och har redan CRON_SECRET och
   lazy-fallback-mönstret.
3. Vy "Vencen pronto" (≤45 dagar) med wa.me-länk vars meddelande innehåller
   årets statistik. Statistiken hämtas från `getBusinessAnalytics()` i
   `src/db/analytics-queries.ts` — den finns och är testad.
4. Pengar visas alltid som `formatGs()` (`₲ 300.000`, inga decimaler).
5. Utöka `npm run smoke` med betalningsflödet, och kör den mot en lokal MySQL
   innan PR:en stängs. Så här sätter du upp den i en tom container:

   ```bash
   apt-get update -qq && apt-get install -y -qq mysql-server
   mkdir -p /var/lib/mysql-files /var/run/mysqld && chown mysql:mysql /var/lib/mysql-files /var/run/mysqld
   mysqld --initialize-insecure --user=mysql && mysqld --user=mysql --daemonize
   mysql -uroot -e "create database sitio character set utf8mb4;
     create user 'sitio'@'127.0.0.1' identified by 'sitio-dev';
     grant all on sitio.* to 'sitio'@'127.0.0.1';"
   ```

   Sedan `.env.local` med `DATABASE_URL=mysql://sitio:sitio-dev@127.0.0.1:3306/sitio`,
   `npm run db:migrate && npm run db:seed`.

Regler som gäller oförändrat: inga filer under `.github/workflows/`, noll
hårdkodade absolut-URL:er, spanska (voseo) i kund-UI och svenska i superadmin,
varje mutation bakom `requireRole()` + tenant-filter, och QA-gaten
(`theme:preview` + `theme:shots`) före varje temaändring.

## Kända skavanker (inte buggar som blockerar något)

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
