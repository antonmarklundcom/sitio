# Läge och nästa steg

> Uppdaterad i slutet av sessionen som byggde PR-12 och PR-13. Läs den här filen först i
> nästa session, sedan `PLAN.md`.

## Var bygget står

| PR | Innehåll | Status |
|---|---|---|
| PR-01…PR-06 | Scaffold, datamodell, seed, superadmin-auth, businesses-CRUD, media-pipeline, publik rendering + tema `servicios` | Mergad (#3–#6) |
| **PR-07** | Teman `gastronomia` + `comercio`, fyra palettvarianter per tema, temaväljare med färgprover i admin, QA-gate med skärmdumpar | Mergad (#7) |
| **PR-08** | `/api/ev`-ingest, rollup till `analytics_daily`, adminstatistik, `npm run smoke` mot riktig MySQL | Mergad (#8) |
| **PR-09** | Prenumerationer, betalningsadmin, livscykel active→grace→expired, "Vencen pronto" | Mergad (#10) |
| **PR-10** | Intake med tokenad länk, tre steg, manuell WhatsApp-OTP | Mergad (#11) |
| **PR-11** | Owner-auth (WhatsApp-OTP), `/admin/accesos`, `/mi-sitio` med whitelistad redigering | Mergad (#13) |
| **PR-12** | Modul-infra: modulväxel per kund i admin, `photoLimitFor()` som enda fototakskälla, owner sorterar sina foton | Mergad (#15) |
| **PR-13** | Meny-modulen: owner-CRUD i `/mi-sitio`, rendering i alla tre teman, `menu_view`/`gallery_view` som vy-event | Mergad |
| PR-14 → | Fas 2 fortsätter: produkter, teman 4–6, radar | **Nästa** |

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
- Modulerna (PR-12): växeln av → på → av, `enabledAt` sätts, fototaket följer
  modulen i både owner-panelen och `/api/upload`, obyggda moduler märks som
  obyggda, och owners omsortering slår igenom på den publika sajten via ISR.
- Meny-modulen (PR-13): sektioner och rätter skapas, tomt pris blir
  "A consultar", "no hay hoy" döljer rätten publikt men behåller den i panelen,
  menyn slår igenom på sajten via ISR, avstängd modul döljer menyn utan att
  radera den, och en post från en flik som stod öppen när modulen stängdes av
  nekas av serveråtgärden.

PR-12 lagade också två röktest som ljög: fotouppladdningen i admin träffade
betalningsformulärets kvittofält (`input[type=file]` matchade det först på
sidan, och kvittofältet ligger före bildrutan), och owner-kontokontrollen
matchade skiftlägeskänsligt mot en rubrik som CSS versaliserar — så knappen
"Skapa konto" klickades aldrig. Båda passerade grönt utan att mäta något.

Röktestet är nu 75 kontroller. Kör det efter varje PR som rör admin, intake,
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

## Nästa session: PR-14 (products-modulen)

`products` är samma mönster som menyn, med en tabell i stället för två:

1. `products`-tabellen finns i schemat (namn, beskrivning, `priceGs`, `mediaId`,
   `isVisible`, `sortOrder`). Ingen migrering.
2. Kopiera kedjan från PR-13 rakt av: `src/lib/menu-form.ts` →
   `product-form.ts`, `src/db/menu-queries.ts` → `product-queries.ts`,
   `src/app/mi-sitio/menu-actions.ts` → `product-actions.ts` (samma
   `menuContext()`-mönster: modulen kontrolleras på servern, inte i UI:t), och
   `SiteMenu` → en `SiteProducts`-primitiv i `theme.css`.
3. Rendering i `comercio`-temat plus generisk fallback i övriga.
4. Sätt `plannedIn: undefined` för `products` i `src/lib/modules.ts` när den är
   byggd — annars fortsätter adminet säga "ej byggt än".
5. Utöka `npm run smoke` (75 kontroller i dag) och kör mot en lokal MySQL innan
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
   Verifierat i PR-12: apt-vägen fungerar i sandlådan även när Docker Hub är
   blockerat.

Kvar i menyn (medvetet uppskjutet från PR-13): **bild per rätt.** `menuItems.mediaId`
finns i schemat men används inte än. Det kräver att `/api/upload` släpper igenom
`menu_item` för en owner-session och kopplar bilden till rätten — samma
tenant-kontroll som i dag, men en ny kind. Menyn fungerar och säljer utan det.

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
- Modulväxeln ändrar inte prenumerationens pris. Priset sätts av dig utanför
  systemet (PLAN.md D10) — `enabledAt` är datumet du räknar året från.
- Sorteringen flyttar en bild ett steg i taget. Drag-and-drop är trevligare men
  kräver klientstate och touch-hantering; med 8–20 bilder räcker knapparna.
  Samma gäller menyns sektioner och rätter.
- Menyn kan bara redigeras av owner, inte av superadmin. Det följer gränsen
  ovan, men betyder att en kund som inte vill röra panelen inte får någon meny.
  När det blir ett problem är lösningen en adminvy som loggar mot rätt aktör —
  inte att låta `/mi-sitio` spara med superadmin-session.

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
