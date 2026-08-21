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
  const why = await p.locator('body').innerText();
  // Inloggningens rate limit är per process och gäller 15 minuter. Två
  // smoke-körningar tätt inpå varandra slår i den — starta om servern.
  if (why.includes('För många försök')) {
    console.error('avbryter: inloggningens rate limit slog till. Starta om servern och kör igen.');
  } else {
    console.error('avbryter: inloggningen gick inte igenom —', why);
  }
  await b.close();
  process.exit(1);
}

// 2. lista
await p.goto(B+'/admin', { waitUntil: 'domcontentloaded' });
// Ordningen är senast ändrad först, så raden för seedens sajt kan ligga var
// som helst — testet skapar egna sajter i senare steg.
const listText = await p.locator('tbody').first().innerText({ timeout: 15000 });
ok('lista renderar', listText.includes('Electricidad'));

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
// Uttryckligen fotouppladdaren: betalningsformuläret har ett eget
// input[type=file] för kvitton, och det ligger före bildrutan på sidan.
await p.locator('input[name=photo]').first().setInputFiles({ name: 'smoke.jpg', mimeType: 'image/jpeg', buffer: jpeg });
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

// 10. intake: länk → kundformulär utan inloggning → foto via token → OTP → inlämning
await p.goto(B + '/admin/alta', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1000);
const negocio = 'Panadería Smoke ' + Date.now().toString().slice(-4);
await p.fill('input[name=name]', negocio);
await p.fill('input[name=phone]', '0985 334 221');
await p.getByRole('button', { name: /Skapa länk/ }).click();
await p.waitForTimeout(2500);
ok('intake-länk skapad', (await p.locator('body').innerText()).includes(negocio));

const intakeUrl = await p.locator('button[title^="http"]').first().getAttribute('title');
const token = (intakeUrl ?? '').split('/alta/')[1] ?? '';
ok('token utdelad', /^[0-9a-f]{32}$/.test(token));

const cust = await b.newPage();
await cust.goto(B + '/alta/' + token, { waitUntil: 'domcontentloaded' });
await cust.waitForTimeout(800);
ok('kundformuläret öppnas utan inloggning', (await cust.locator('h1').innerText()).includes('Panader'));

await cust.fill(
  'textarea[name=rawDescription]',
  'Panadería de barrio con pan casero, facturas y tortas por encargo. Atendemos todos los días desde temprano.',
);
await cust.fill('input[name="service.0.name"]', 'Pan casero');
await cust.fill('input[name="service.1.name"]', 'Tortas por encargo');
await cust.fill('input[name=whatsappPhone]', '0985 334 221');
await cust.fill('input[name=city]', 'Luque');
await cust.getByRole('button', { name: /Guardar y seguir/ }).click();
await cust.waitForTimeout(2500);
ok('steg 1 sparat', cust.url().includes('paso=fotos'));

await cust.waitForLoadState('networkidle');
await cust.waitForTimeout(1200);
await cust.locator('input[type=file]').last().setInputFiles({ name: 'pan.jpg', mimeType: 'image/jpeg', buffer: jpeg });
await cust.waitForTimeout(4000);
ok('foto uppladdat via intake-token', (await cust.locator('.panel-photos img').count()) > 0);

// Behörighetsgränserna för tokenläget i uppladdningsrouten.
const anon = new FormData();
anon.set('kind', 'photo');
anon.set('businessId', '1');
anon.set('file', new File([jpeg], 'x.jpg', { type: 'image/jpeg' }));
ok('uppladdning utan token/session nekas', (await fetch(B + '/api/upload', { method: 'POST', body: anon })).status === 401);

const receipt = new FormData();
receipt.set('kind', 'receipt');
receipt.set('token', token);
receipt.set('file', new File([jpeg], 'x.jpg', { type: 'image/jpeg' }));
ok('kvittouppladdning med intake-token nekas', (await fetch(B + '/api/upload', { method: 'POST', body: receipt })).status === 403);

await cust.goto(B + '/alta/' + token + '?paso=verificacion', { waitUntil: 'domcontentloaded' });
await cust.waitForTimeout(1000);
await cust.getByRole('button', { name: /Pedir el código/ }).click();
await cust.waitForTimeout(2000);

await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Generera kod' }).first().click();
await p.waitForTimeout(2500);
const code = ((await p.locator('body').innerText()).match(/\b\d{6}\b/) || [])[0];
ok('OTP-kod genererad och visad en gång för admin', Boolean(code));

await cust.fill('input[name=code]', '000000');
await cust.getByRole('button', { name: /Verificar/ }).click();
await cust.waitForTimeout(2000);
ok('fel kod avvisas', (await cust.locator('body').innerText()).includes('no coincide'));

await cust.fill('input[name=code]', code ?? '');
await cust.getByRole('button', { name: /Verificar/ }).click();
await cust.waitForTimeout(2500);
ok('rätt kod verifierar numret', (await cust.locator('body').innerText()).includes('verificado'));

await cust.getByRole('button', { name: /Enviar mis datos/ }).click();
await cust.waitForTimeout(3000);
ok('inlämning ger tacksida', cust.url().includes('listo=1'));
ok('länken stängd efter inlämning', (await fetch(B + '/alta/' + token)).status === 404);

await p.goto(B + '/admin?status=pending_review', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1000);
ok('sajten ligger i granskningskön', (await p.locator('body').innerText()).includes(negocio));

// 11. owner-auth och /mi-sitio: konto, OTP-login, redigering, tenant-gränser
await p.goto(B + '/admin/accesos', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
// Rubrikerna är versaliserade med CSS, och innerText följer text-transform —
// en skiftlägeskänslig jämförelse här missade knappen helt och tyst.
if (/utan owner-konto/i.test(await p.locator('body').innerText())) {
  await p.getByRole('button', { name: 'Skapa konto' }).first().click();
  await p.waitForTimeout(3000);
  await p.goto(B + '/admin/accesos', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
}
ok('owner-konto finns', (await p.locator('table tbody tr').count()) > 0);

const ownerPhone = (await p.locator('table tbody tr').first().locator('td').nth(1).innerText()).replace(/\s/g, '');
ok('owner har ett nummer', /^\+595\d+$/.test(ownerPhone));

const owner = await b.newPage();
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
ok('/mi-sitio kräver inloggning', owner.url().includes('/mi-sitio/login'));

await owner.fill('input[name=phone]', ownerPhone);
await owner.getByRole('button', { name: /Pedir código/ }).click();
await owner.waitForTimeout(2500);
const neutral = 'Si el número está registrado';
ok('kodbegäran kvitteras neutralt', (await owner.locator('body').innerText()).includes(neutral));

// Ett okänt nummer måste ge exakt samma svar — annars är inloggningssidan en
// kunddatabas att fiska i.
const stranger = await b.newPage();
await stranger.goto(B + '/mi-sitio/login', { waitUntil: 'domcontentloaded' });
await stranger.fill('input[name=phone]', '0999 000 111');
await stranger.getByRole('button', { name: /Pedir código/ }).click();
await stranger.waitForTimeout(2000);
ok('okänt nummer ger samma svar', (await stranger.locator('body').innerText()).includes(neutral));
await stranger.close();

await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
ok('admin ser att kunden väntar på kod', (await p.locator('body').innerText()).includes('väntar på en kod'));
await p.getByRole('button', { name: 'Generera kod' }).first().click();
await p.waitForTimeout(2500);
const ownerCode = ((await p.locator('body').innerText()).match(/\b\d{6}\b/) || [])[0];
ok('inloggningskod genererad', Boolean(ownerCode));

await owner.fill('input[name=code]', '000000');
await owner.getByRole('button', { name: 'Entrar' }).click();
await owner.waitForTimeout(2000);
ok('fel kod nekas', (await owner.locator('body').innerText()).includes('No pudimos verificar'));

await owner.fill('input[name=code]', ownerCode ?? '');
await owner.getByRole('button', { name: 'Entrar' }).click();
await owner.waitForTimeout(3000);
ok('rätt kod loggar in', owner.url().endsWith('/mi-sitio'));

const ownerText = await owner.locator('body').innerText();
ok('statistik visas för owner', ownerText.includes('Tu página en números'));
ok('inga adminfält läcker till owner', !/Palett|Tema|SEO/i.test(ownerText));

await owner.goto(B + '/admin', { waitUntil: 'domcontentloaded' });
ok('owner blockeras från /admin', owner.url().includes('/admin/login'));

await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
await owner.waitForTimeout(1200);
const nuevaDesc =
  'Descripción actualizada por el dueño ' + Date.now().toString().slice(-5) +
  '. Trabajamos todos los días y atendemos pedidos por WhatsApp sin vueltas.';
await owner.fill('textarea[name=description]', nuevaDesc);
await owner.getByRole('button', { name: /Guardar cambios/ }).click();
await owner.waitForTimeout(3000);
ok('owner-ändring sparad', (await owner.locator('body').innerText()).includes('¡Guardado!'));

const liveHref = await owner.locator('.panel-top a').first().getAttribute('href').catch(() => null);
if (liveHref) {
  const ownerSlug = liveHref.split('/').pop();
  const pubHtml = await (await fetch(B + '/' + ownerSlug)).text();
  ok('publika sajten uppdaterad (ISR)', pubHtml.includes(nuevaDesc.slice(0, 40)));
} else {
  ok('publika sajten uppdaterad (ISR)', false, 'ingen publik länk i panelen');
}

// Tenant-gränsen: owner postar ett främmande businessId, rutten ska ändå
// skriva till ägarens egen sajt — den läser tenanten ur sessionen.
const ownerCookies = (await owner.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
const crossTenant = new FormData();
crossTenant.set('kind', 'photo');
crossTenant.set('businessId', '2');
crossTenant.set('file', new File([jpeg], 'x.jpg', { type: 'image/jpeg' }));
const crossRes = await fetch(B + '/api/upload', { method: 'POST', headers: { cookie: ownerCookies }, body: crossTenant });
const crossJson = await crossRes.json().catch(() => ({}));
ok(
  'owner kan inte ladda upp till annans sajt',
  crossRes.status === 200 && typeof crossJson.fileKey === 'string' && !crossJson.fileKey.startsWith('2/'),
);

// 12. moduler (PR-12): superadmin slår på/av, owner ser effekten
// Owner-sajtens slug läses ur panelen — testet ska inte gissa vilket business
// seeden gav owner-kontot.
const ownerSlug12 = (await owner.locator('.panel-top a').first().getAttribute('href').catch(() => null))?.split('/').pop() ?? null;

const modulesCardFor = (page) => page.locator('section').filter({ hasText: /moduler/i }).last();
const galleryRowFor = (page) => modulesCardFor(page).locator('li').filter({ hasText: 'gallery' }).first();

await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
ok('modulpanelen finns i admin', await modulesCardFor(p).getByText('gallery').first().isVisible());
ok('obyggda moduler flaggas som obyggda', /ej byggt än/i.test(await modulesCardFor(p).innerText()));

// Utgångsläget beror på seeden och på tidigare körningar — nolla det först.
if ((await galleryRowFor(p).innerText()).includes('Stäng av')) {
  await galleryRowFor(p).getByRole('button', { name: 'Stäng av' }).click();
  await p.waitForTimeout(2500);
  await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
}
const galleryOffText = await galleryRowFor(p).innerText();
ok('galleriet är av', galleryOffText.includes('Slå på'));
ok('fototaket visar basplanen', galleryOffText.includes('/8'), galleryOffText.replace(/\n/g, ' | '));

await galleryRowFor(p).getByRole('button', { name: 'Slå på' }).click();
await p.waitForTimeout(2500);
await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const galleryOnText = await galleryRowFor(p).innerText();
ok('galleriet slås på', galleryOnText.includes('Stäng av'));
ok('aktiveringsdatum registreras', galleryOnText.includes('Aktiverad'));
ok('fototaket höjs till 20', galleryOnText.includes('/20'), galleryOnText.replace(/\n/g, ' | '));

// 13. owner-vyn: sortering av egna foton, och inga modulväxlar
// Två foton behövs för att kunna byta ordning på något.
const ownerCookies13 = (await owner.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
for (let i = 0; i < 2; i++) {
  const extra = new FormData();
  extra.set('kind', 'photo');
  extra.set('file', new File([jpeg], `orden-${i}-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  await fetch(B + '/api/upload', { method: 'POST', headers: { cookie: ownerCookies13 }, body: extra });
}

await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
await owner.waitForTimeout(1500);
const ownerPhotoIds = async () => {
  const values = await owner.locator('.panel-photo-order input[name=mediaId]').evaluateAll((els) => els.map((el) => el.value));
  return values.filter((v, i) => values.indexOf(v) === i);
};

const beforeOrder = await ownerPhotoIds();
ok('owner har sorteringsknappar', beforeOrder.length >= 2, `${beforeOrder.length} foton`);
ok('owner ser inga modulväxlar', !/Slå på|Stäng av/.test(await owner.locator('body').innerText()));

if (beforeOrder.length >= 2) {
  await owner
    .locator('.panel-photo-order form')
    .filter({ has: owner.locator('input[value=down]') })
    .first()
    .getByRole('button')
    .click();
  await owner.waitForTimeout(3000);
  const afterOrder = await ownerPhotoIds();
  ok(
    'sorteringen byter plats på de två första',
    afterOrder[0] === beforeOrder[1] && afterOrder[1] === beforeOrder[0],
    `${beforeOrder.join(',')} → ${afterOrder.join(',')}`,
  );

  // Ordningen måste slå igenom publikt, annars är knappen en illusion:
  // ISR-cachen serverar den gamla ordningen tills taggen slängs. Varianterna
  // delar hashprefix (<hash>-w400.webp), så prefixet identifierar bilden.
  if (ownerSlug12) {
    const prefixes = await owner
      .locator('.panel-photos figure', { has: owner.locator('.panel-photo-order') })
      .locator('img')
      .evaluateAll((els) => els.map((el) => (el.getAttribute('src') ?? '').split('/').pop().split('-w')[0]));
    const html = await (await fetch(B + '/' + ownerSlug12)).text();
    const at = (prefix) => html.indexOf(prefix);
    ok(
      'publika sajten följer den nya ordningen',
      prefixes.length >= 2 && at(prefixes[0]) >= 0 && at(prefixes[1]) >= 0 && at(prefixes[0]) < at(prefixes[1]),
      `${prefixes.slice(0, 2).join(' → ')} @ ${at(prefixes[0])}, ${at(prefixes[1])}`,
    );
  }
}

// En owner får aldrig kunna slå på sin egen upsell — växeln ligger bakom
// requireRole("superadmin"), inte bakom att knappen är dold.
await owner.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
ok('owner når inte modulväxeln', owner.url().includes('/admin/login'));

// 14. menu-modulen (PR-13): växel, owner-CRUD, rendering, tillgänglighet
// Owner-sajtens id läses ur en av panelens bild-URL:er (/media/<id>/…) i
// stället för att antas vara 1 — seeden bestämmer vilket business som får
// owner-kontot, inte testet.
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
await owner.waitForTimeout(1200);
const ownerBizId = ((await owner.locator('.panel-photos img').first().getAttribute('src')) ?? '').split('/')[2];
ok('owner-sajtens id kunde läsas', /^\d+$/.test(ownerBizId), ownerBizId);
ok('menyn syns inte utan modulen', !(await owner.locator('body').innerText()).includes('Tu carta'));

await p.goto(B + '/admin/sitios/' + ownerBizId, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const menuRow = () => modulesCardFor(p).locator('li').filter({ hasText: 'menu' }).first();
ok('menyn är byggd och märks inte som obyggd', !/ej byggt än/i.test(await menuRow().innerText()));
if ((await menuRow().innerText()).includes('Slå på')) {
  await menuRow().getByRole('button', { name: 'Slå på' }).click();
  await p.waitForTimeout(2500);
}

await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
await owner.waitForTimeout(1500);
ok('menyredigeraren dyker upp med modulen', (await owner.locator('body').innerText()).includes('Tu carta'));

const seccion = 'Entradas ' + Date.now().toString().slice(-4);
await owner.fill('#new-section', seccion);
await owner.getByRole('button', { name: 'Agregar sección' }).click();
await owner.waitForTimeout(3000);
ok('sektion skapad', (await owner.locator('body').innerText()).includes(seccion));

// En rätt med pris och en utan: tomt prisfält ska bli "A consultar", inte 0.
await owner.getByRole('button', { name: new RegExp('Agregar plato') }).first().click();
await owner.waitForTimeout(600);
await owner.locator('.panel-menu-form input[name=name]').first().fill('Empanada de carne');
await owner.locator('.panel-menu-form input[name=priceGs]').first().fill('8000');
await owner.getByRole('button', { name: 'Agregar plato' }).last().click();
await owner.waitForTimeout(3000);
const menuText = await owner.locator('body').innerText();
ok('plato med pris sparat', menuText.includes('Empanada de carne') && menuText.includes('8.000'));

await owner.getByRole('button', { name: new RegExp('Agregar plato a') }).first().click();
await owner.waitForTimeout(600);
await owner.locator('.panel-menu-form input[name=name]').first().fill('Pescado del día');
await owner.locator('.panel-menu-form input[name=priceGs]').first().fill('');
await owner.getByRole('button', { name: 'Agregar plato' }).last().click();
await owner.waitForTimeout(3000);
ok('tomt pris blir "A consultar"', (await owner.locator('body').innerText()).includes('A consultar'));

const ownerSlug14 = ((await owner.locator('.panel-top a').first().getAttribute('href').catch(() => null)) ?? '').split('/').pop();
if (ownerSlug14) {
  const html = await (await fetch(B + '/' + ownerSlug14)).text();
  ok('menyn syns på publika sajten (ISR)', html.includes('Empanada de carne') && html.includes(seccion));
  ok('menyn skickar menu_view', html.includes('data-ev-view="menu_view"'));
}

// "No hay hoy": rätten ska bort från sajten men ligga kvar i panelen — annars
// måste kunden skriva in den på nytt i morgon.
await owner.locator('.panel-menu-items li').filter({ hasText: 'Empanada de carne' }).first()
  .getByRole('button', { name: 'No hay hoy' }).click();
await owner.waitForTimeout(3000);
ok('slutsåld rätt ligger kvar i panelen', (await owner.locator('body').innerText()).includes('Empanada de carne'));
if (ownerSlug14) {
  const html = await (await fetch(B + '/' + ownerSlug14)).text();
  ok('slutsåld rätt döljs på sajten', !html.includes('Empanada de carne'));
}

// Modulen av: menyn försvinner från sajten, men datat ligger kvar och kommer
// tillbaka när den slås på igen. Owner-sidan lämnas medvetet öppen — nästa
// kontroll använder den som en gammal flik.
await owner.getByRole('button', { name: new RegExp('Agregar plato a') }).first().click();
await owner.waitForTimeout(600);
await owner.locator('.panel-menu-form input[name=name]').first().fill('Plato fantasma');

await p.goto(B + '/admin/sitios/' + ownerBizId, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await menuRow().getByRole('button', { name: 'Stäng av' }).click();
await p.waitForTimeout(2500);
if (ownerSlug14) {
  const html = await (await fetch(B + '/' + ownerSlug14)).text();
  ok('avstängd modul döljer menyn', !html.includes(seccion));
}

// Serveråtgärden måste neka posten från den gamla fliken. Modulkontrollen
// ligger i menuContext(), inte i att knappen inte renderas.
await owner.getByRole('button', { name: 'Agregar plato' }).last().click();
await owner.waitForTimeout(3000);
ok(
  'avstängd modul nekar posten från en gammal flik',
  (await owner.locator('body').innerText()).includes('No pudimos guardar'),
);

await p.goto(B + '/admin/sitios/' + ownerBizId, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await menuRow().getByRole('button', { name: 'Slå på' }).click();
await p.waitForTimeout(2500);
if (ownerSlug14) {
  const html = await (await fetch(B + '/' + ownerSlug14)).text();
  ok('avstängning raderar inte menyn', html.includes(seccion));
  ok('den nekade rätten skrevs aldrig', !html.includes('Plato fantasma'));
}

await b.close();
console.log(failed === 0 ? '\nAllt grönt.' : `\n${failed} kontroll(er) föll.`);
process.exit(failed === 0 ? 0 : 1);
