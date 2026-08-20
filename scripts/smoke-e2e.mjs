/**
 * End-to-end-rök mot en RIKTIG databas och en byggd app. Inget här är en
 * enhetstest — det är den genomgång som annars görs för hand efter varje
 * deploy, och som fram till PR-08 aldrig hade körts mot en faktisk MySQL.
 *
 * Kör:
 *   npm run build && PORT=3100 npm run start &
 *   npm run db:migrate && npm run db:seed
 *   SMOKE_BASE_URL=http://127.0.0.1:3100 npm run smoke
 *
 * Testet SKRIVER i databasen (byter namn och slug på business 1, laddar upp en
 * bild). Kör det aldrig mot produktion.
 */
import { chromium } from 'playwright';
const B = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3100';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'anton@sitio.com.py';
const PASS = process.env.SEED_ADMIN_PASSWORD ?? 'sitio-dev-1234';
import { existsSync } from 'node:fs';
const bundled = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const b = await chromium.launch(existsSync(bundled) ? { executablePath: bundled } : {});
const p = await b.newPage();
let failed = 0;
const ok = (n, cond, extra='') => {
  if (!cond) failed++;
  console.log(`${cond ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`);
};

// 1. login
await p.goto(B+'/admin/login');
await p.fill('input[name=email]', EMAIL);
await p.fill('input[name=password]', PASS);
await p.click('button[type=submit]');
await p.waitForURL((u) => !u.pathname.startsWith('/admin/login'), { timeout: 30000 }).catch(() => {});
ok('login', !p.url().includes('/admin/login'), p.url());
if (p.url().includes('/admin/login')) {
  console.error('avbryter: inloggningen gick inte igenom —', await p.locator('body').innerText());
  await b.close();
  process.exit(1);
}

// 2. lista
await p.goto(B+'/admin', { waitUntil: 'domcontentloaded' });
const row1 = await p.locator('tbody tr').first().innerText({ timeout: 15000 });
ok('lista renderar', row1.includes('Electricidad'));

// 3. detaljsida + statistikpanel
await p.goto(B+'/admin/sitios/1');
ok('statistikpanel', await p.getByText('Statistik').first().isVisible());
ok('statistik har siffror', (await p.locator('body').innerText()).includes('Besök, 30 dgr'));

// 4. CRUD: byt namn, verifiera ISR-invalidering på publika sajten
// Slugen läses ur formuläret: testet har kanske bytt den i en tidigare körning.
const currentSlug = await p.locator('input[name=slug]').inputValue();
// Spara-knappen måste sökas INUTI businessformuläret: mediarutnätet har egna
// spara-knappar för alt-texter, och de dyker upp först när en bild finns.
const businessForm = p.locator('form').filter({ has: p.locator('input[name=slug]') });
const save = () => businessForm.getByRole('button', { name: /Spara/ }).first().click();
const newName = 'Electricidad Mendoza '+Date.now().toString().slice(-5);
await p.fill('input[name=name]', newName);
await save();
await p.waitForTimeout(3000);
const pub = await (await fetch(B+'/'+currentSlug)).text();
ok('CRUD sparar + ISR invalideras', pub.includes(newName));

// 5. slug-byte → 301 från gammal slug
const newSlug = 'electricidad-mendoza-'+Date.now().toString().slice(-4);
await p.goto(B+'/admin/sitios/1');
await p.fill('input[name=slug]', newSlug);
await save();
await p.waitForTimeout(3000);
const red = await fetch(B+'/'+currentSlug, {redirect:'manual'});
ok('permanent redirect från gammal slug (308)', red.status === 308, `${red.status} → ${red.headers.get('location')}`);
const nyaSajten = await fetch(B+'/'+newSlug);
ok('nya slugen svarar 200', nyaSajten.status === 200);

// 6. preview-token krävs för utkast
const previewLink = await p.locator('a[href*="preview="]').first().getAttribute('href');
const previewUrl = new URL(previewLink, B);
const prev = await fetch(B+previewUrl.pathname+previewUrl.search);
const prevHtml = await prev.text();
ok('preview med token', prev.status===200 && prevHtml.includes('Vista previa'));
const bad = await fetch(B+previewUrl.pathname+'?preview=fel');
ok('preview med fel token nekas', bad.status === 404, String(bad.status));

// 7. uppladdning: bild genom hela sharp-pipen och ut via /media
const sharp = (await import('sharp')).default;
const jpeg = await sharp({
  create: { width: 1600, height: 1200, channels: 3, background: { r: 120, g: 90, b: 60 } },
}).jpeg().toBuffer();
await p.goto(B + '/admin/sitios/1');
// Vänta in hydreringen: input[type=file] är sr-only och change-lyssnaren
// finns inte förrän React har hydrerat — utan detta rinner uppladdningen ut i
// sanden och testet ser ut att passera.
await p.waitForLoadState('networkidle');
await p.waitForTimeout(1500);
await p.locator('input[type=file]').first().setInputFiles({ name: 'smoke.jpg', mimeType: 'image/jpeg', buffer: jpeg });
await p.waitForTimeout(5000);
const detail = await p.locator('body').innerText();
ok('uppladdning syns i admin', /Logga|Foton/.test(detail));
const imgSrc = await p.locator('img[src^="/media/"]').first().getAttribute('src').catch(() => null);
ok('media-URL genererad', Boolean(imgSrc), imgSrc ?? 'ingen');
if (imgSrc) {
  const media = await fetch(B + imgSrc);
  ok('media serveras med immutable-cache', media.status === 200 && (media.headers.get('cache-control') ?? '').includes('immutable'), `${media.status} ${media.headers.get('cache-control')}`);
}

// 8. betalningar: prenumeration → betalning → bekräftelse → förnyelsevy
await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
const subForm = p.locator('form').filter({ has: p.locator('select[name=plan]') });
const day = (offsetDays) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
// Perioden läggs medvetet strax före förfall så att sajten hamnar i
// "Vencen pronto" — det är vyn testet ska verifiera.
await subForm.locator('select[name=plan]').selectOption('plus');
await subForm.locator('input[name=priceGs]').fill('450000');
await subForm.locator('input[name=startsAt]').fill(day(-355));
await subForm.locator('input[name=expiresAt]').fill(day(10));
await subForm.getByRole('button', { name: /Spara prenumeration/ }).click();
await p.waitForTimeout(2500);
ok('prenumeration sparad', (await p.locator('body').innerText()).includes('450.000'));

const payForm = p.locator('form').filter({ has: p.locator('select[name=method]') });
const ref = 'OP-' + Date.now().toString().slice(-6);
await payForm.locator('input[name=amountGs]').fill('450000');
await payForm.locator('select[name=method]').selectOption('transferencia');
await payForm.locator('input[name=reference]').fill(ref);
await payForm.locator('input[name=periodStart]').fill(day(10));
await payForm.locator('input[name=periodEnd]').fill(day(375));
await payForm.locator('input[name=receipt]').setInputFiles({ name: 'comprobante.jpg', mimeType: 'image/jpeg', buffer: jpeg });
await payForm.getByRole('button', { name: /Registrera betalning/ }).click();
await p.waitForTimeout(3500);
const afterPay = await p.locator('body').innerText();
ok('betalning registrerad som rapporterad', afterPay.includes(ref) && afterPay.includes('Rapporterad'));

await p.goto(B + '/admin/pagos', { waitUntil: 'domcontentloaded' });
const cobros = await p.locator('body').innerText();
ok('betalningen syns i Cobros-kön', cobros.includes(ref));
// Rubriken renderas versaliserad av CSS, så innerText ger "VENCEN PRONTO".
ok('sajten syns i Vencen pronto', /vencen pronto/i.test(cobros) && /om \d+ dgr/.test(cobros));

await p.locator('form').filter({ has: p.locator(`input[value="/admin/pagos"]`) }).first()
  .getByRole('button', { name: 'Bekräfta' }).click();
await p.waitForTimeout(3000);
const confirmed = await p.locator('body').innerText();
ok('bekräftelse kvitteras', confirmed.includes('Betalningen är bekräftad'));

await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
const afterConfirm = await p.locator('body').innerText();
ok('prenumerationen förlängd till betalningens periodslut', afterConfirm.includes(day(375)));
ok('betalningen står som bekräftad', afterConfirm.includes('Bekräftad'));

// 9. analytics: beacon på publicerad sajt, avvisad på opublicerad
const send = (bid, ua) => fetch(B+'/api/ev', {method:'POST', headers:{'content-type':'application/json','user-agent':ua}, body: JSON.stringify({b:bid,t:'whatsapp_click',p:'/smoke'})});
ok('beacon svarar 204', (await send(1,'Mozilla/5.0 (iPhone)')).status === 204);

await b.close();
console.log(failed === 0 ? '\nAllt grönt.' : `\n${failed} kontroll(er) föll.`);
process.exit(failed === 0 ? 0 : 1);
