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

MariaDB duger inte: drizzles `serial AUTO_INCREMENT` är MySQL-syntax och
migreringarna faller. Apt-vägen fungerar i sandlådan även när Docker Hub är
blockerat.

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

**Inloggningens rate limit är 5 försök per 15 minuter och lever i processen.**
Två körningar tätt inpå varandra slår i den och `_lib.mjs` avbryter med ett
tydligt meddelande. Starta om servern och kör igen.

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
