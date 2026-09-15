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
  'servicios visar variant 2 (cyan)',
  (await p.locator('body').innerText()).includes('servicios · variante 2 (cian)'),
);

await p.selectOption('select[name=category]', 'taller');
await p.waitForTimeout(400);
ok(
  'taller härleds till servicios · variant 1 (orange) direkt, före spar',
  (await p.locator('body').innerText()).includes('servicios · variante 1 (naranja)'),
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
  (await p.locator('body').innerText()).includes('servicios · variante 1 (naranja)'),
);

const tallerHtml = await previewHtml(p);
// `servicios` är bastemat: dess rot är `.site-root` utan t-klass (de andra
// temana lägger till sin egen). Accenten är det som skiljer variant 1 från 2.
ok('sidroten är servicios (site-root utan annan t-klass)', /class="site-root[^"]*"/.test(tallerHtml));
ok(
  'inget annat tema renderas',
  !/t-comercio|t-gastronomia|t-salud/.test(tallerHtml),
);
ok('variant 1: orange accent #FF8A1F', tallerHtml.includes('#FF8A1F'));
ok('inte servicios variant 2 (cyan)', !tallerHtml.includes('#2ACADC'));

// ---------- 3. byt bransch: presentationen härleds om vid spar ----------
const form = p.locator('form').filter({ has: p.locator('select[name=category]') }).first();
await form.locator('select[name=category]').selectOption('comercio');
await p.waitForTimeout(400);
ok(
  'comercio härleds till variant 1 (blå) i formuläret',
  (await p.locator('body').innerText()).includes('comercio · variante 1 (azul)'),
);

await form.getByRole('button', { name: /Guardar/ }).first().click();
await p.waitForTimeout(3000);
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
ok(
  'admin visar comercio efter spar',
  (await p.locator('body').innerText()).includes('comercio · variante 1 (azul)'),
);

const comercioHtml = await previewHtml(p);
ok('sidroten bär t-comercio', comercioHtml.includes('t-comercio'));
ok('variant 1: blå accent #0E4E96', comercioHtml.includes('#0E4E96'));
ok('den gamla orange accenten är borta', !comercioHtml.includes('#FF8A1F'));

await finish(b, failed());
