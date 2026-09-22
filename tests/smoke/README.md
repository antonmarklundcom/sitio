# Rökkörningar

`npm run smoke` kör `scripts/smoke-e2e.mjs` (75 kontroller genom hela
superadmin, intake, uppladdning, betalningar, analytics och menyn) och därefter
varje `tests/smoke/*.mjs` som inte börjar med `_`. Varje fas som lägger till
funktionalitet lägger sin egen fil här i stället för att bygga vidare på
e2e-filen — två parallella faser kan inte båda redigera samma 500-radersfil.

Allt här kräver en **byggd app och en riktig MySQL**, och **skriver i
databasen** (byter namn och slug på business 1, laddar upp bilder, registrerar
betalningar). Kör det aldrig mot produktion.

## MySQL 8 i en tom container

Schemat är MariaDB-säkert sedan R3-6 (`bigint unsigned AUTO_INCREMENT`, inte
`serial`), så båda fungerar; MySQL 8 via apt är den verifierade vägen i
sandlådan även när Docker Hub är blockerat.

```bash
apt-get update -qq && apt-get install -y -qq mysql-server
mkdir -p /var/lib/mysql-files /var/run/mysqld && chown mysql:mysql /var/lib/mysql-files /var/run/mysqld
mysqld --initialize-insecure --user=mysql && mysqld --user=mysql --daemonize
mysql -uroot -e "create database sitio character set utf8mb4;
  create user 'sitio'@'127.0.0.1' identified by 'sitio-dev';
  grant all on sitio.* to 'sitio'@'127.0.0.1';"
```

## Kör

```bash
cat > .env.local <<'ENV'
DATABASE_URL="mysql://sitio:sitio-dev@127.0.0.1:3306/sitio"
NEXT_PUBLIC_BASE_URL="http://127.0.0.1:3100"
SESSION_SECRET="minst-32-tecken-någonting-slumpmässigt-här"
CRON_SECRET="dev-cron-secret"
UPLOADS_DIR="/tmp/sitio-uploads"
ENV

npm run db:migrate && npm run db:seed
npm run build && PORT=3100 npm run start &
SMOKE_BASE_URL=http://127.0.0.1:3100 npm run smoke
```

`SMOKE_BASE_URL` går även att utelämna — `tests/smoke/_lib.mjs` faller tillbaka
på `http://127.0.0.1:3100`. Inloggningen tas från `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`, samma värden som seeden.

**Superadmin loggar in en gång per `npm run smoke`.** Första sviten sparar
Playwrights storageState i `.smoke/admin-state.json` (git-ignorerad); de
följande sviterna återanvänder sessionen och verifierar bara att `/admin`
laddar utan omdirigering till login. Körningen raderar filen vid start, och en
inaktuell session (omdirigering till login) ersätts av en riktig inloggning.
Varje svit behåller sin `login`-rad och skriver ut om sessionen återanvändes
eller hur många login-POST:ar som gjordes.

**Två körningar i rad mot samma databas och server går (R3-12).** e2e:s
menyblock stänger av modulen före första kontrollen och städar bort sin sektion
efteråt; registro och promo skickar en egen `x-forwarded-for` per körning så
att registrets 5/h per IP inte ärvs. Två gränser ligger kvar i processen: en
tredje körning inom 15 minuter når owner-kodens 4 per nummer, och en körning
som kraschat mitt i owner-inloggningen lämnar en oanvänd kod som får "admin ser
att kunden väntar på kod" att falla tills den gått ut (10 min). Starta om
servern, eller vänta.

## Skriva en ny fasfil

```js
import { B, adminLogin, createChecker, finish, launchBrowser } from './_lib.mjs';

const b = await launchBrowser();
const p = await b.newPage();
const { ok, failed } = createChecker();

await adminLogin(p, ok, b);
ok('något stämmer', true);

await finish(b, failed());
```

`_lib.mjs` och `_run.mjs` körs aldrig som egna sviter (understreckprefixet är
vad körningen filtrerar på).
