/**
 * Rök för det branschlåsta utseendet (plan.md §6.5, §1.11).
 *
 * Hela poängen med fasen är att `themeKey`/`paletteVariant` inte längre går
 * att välja: de härleds ur branschen på varje skrivväg. Det syns bara på två
 * ställen — att väljaren är borta i admin, och att den publika sidan faktiskt
 * renderas med det härledda temats palett. Båda kontrolleras här, före och
 * efter ett branschbyte.
 *
 * Sidan hämtas via preview-länken (`/<slug>?preview=<token>`, dynamisk route)
 * i stället för den publika: utkastet skulle behöva foton, verifierat nummer
 * och SEO-text för att få publiceras, och renderingen är samma komponent.
 *
 * Kör av tests/smoke/_run.mjs. Kräver en byggd app och en riktig MySQL —
 * skriver i databasen, kör aldrig mot produktion.
 */
import { B, adminLogin, createChecker, finish, launchBrowser } from './_lib.mjs';

const b = await launchBrowser();
const p = await b.newPage();
const { ok, failed } = createChecker();

await adminLogin(p, ok, b);

const suffix = Date.now().toString().slice(-6);
const slug = `taller-presentacion-${suffix}`;

/** Preview-URL för sajten som visas i admin, mot rökkörningens bas-URL. */
async function previewHtml(page) {
  const href = await page.locator('a[href*="preview="]').first().getAttribute('href');
  const token = (href ?? '').split('preview=')[1];
  const res = await fetch(`${B}/${slug}?preview=${token}`);
  return res.text();
}

// ---------- 1. nuevo: ingen väljare, härledd rad som följer branschen ----------
await p.goto(B + '/admin/sitios/nuevo', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);

ok('ingen temaväljare i formuläret', (await p.locator('select[name=themeKey]').count()) === 0);
ok('inget dolt paletteVariant-fält', (await p.locator('input[name=paletteVariant]').count()) === 0);
ok(
  'raden säger att branschen styr',
  (await p.locator('body').innerText()).includes('El tema y la paleta siguen al rubro'),
);
ok(
  'servicios visar variant 2 (azul)',
  (await p.locator('body').innerText()).includes('servicios · variante 2 (azul)'),
);

await p.selectOption('select[name=category]', 'taller');
await p.waitForTimeout(400);
ok(
  'taller härleds till servicios · variant 1 (ámbar) direkt, före spar',
  (await p.locator('body').innerText()).includes('servicios · variante 1 (ámbar)'),
);

await p.fill('input[name=name]', `Taller Presentación ${suffix}`);
await p.fill('input[name=slug]', slug);
await p.fill('input[name=whatsappPhone]', '0981 555 123');
await p.fill('input[name=city]', 'Asunción');
await p.getByRole('button', { name: 'Crear borrador' }).click();
await p.waitForURL(/\/admin\/sitios\/\d+/, { timeout: 30000 }).catch(() => {});
ok('utkastet skapades', /\/admin\/sitios\/\d+/.test(p.url()), p.url());

// ---------- 2. taller lagras som servicios/1 och renderas orange ----------
await p.waitForTimeout(1500);
ok(
  'admin visar den härledda presentationen för taller',
  (await p.locator('body').innerText()).includes('servicios · variante 1 (ámbar)'),
);

const tallerHtml = await previewHtml(p);
ok('utkastets preview visar bannern (ingen redirect)', tallerHtml.includes('Vista previa'));
// Varje tema bär sin egen t-klass på roten (theme.css v2). Accenten är det
// som skiljer variant 1 från 2 inom temat.
ok('sidroten bär t-servicios', /class="site-root t-servicios"/.test(tallerHtml));
ok(
  'inget annat tema renderas',
  !/t-comercio|t-gastronomia|t-salud/.test(tallerHtml),
);
ok('variant 1: ámbar accent #BE7103', tallerHtml.includes('#BE7103'));
ok('inte servicios variant 2 (azul)', !tallerHtml.includes('#1D4FB8'));

// ---------- 3. byt bransch: presentationen härleds om vid spar ----------
const form = p.locator('form').filter({ has: p.locator('select[name=category]') }).first();
await form.locator('select[name=category]').selectOption('comercio');
await p.waitForTimeout(400);
ok(
  'comercio härleds till variant 1 (carmín) i formuläret',
  (await p.locator('body').innerText()).includes('comercio · variante 1 (carmín)'),
);

await form.getByRole('button', { name: /Guardar/ }).first().click();
await p.waitForTimeout(3000);
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
ok(
  'admin visar comercio efter spar',
  (await p.locator('body').innerText()).includes('comercio · variante 1 (carmín)'),
);

const comercioHtml = await previewHtml(p);
ok('sidroten bär t-comercio', comercioHtml.includes('t-comercio'));
ok('variant 1: carmín accent #C21744', comercioHtml.includes('#C21744'));
ok('den gamla ámbar-accenten är borta', !comercioHtml.includes('#BE7103'));

await finish(b, failed());
