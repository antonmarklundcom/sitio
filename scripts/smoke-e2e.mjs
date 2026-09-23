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
import { B, adminLogin, createChecker, finish, launchBrowser } from '../tests/smoke/_lib.mjs';

const b = await launchBrowser();
const p = await b.newPage();
const { ok, failed } = createChecker();

// 1. login
await adminLogin(p, ok, b);

// 2. lista
await p.goto(B+'/admin', { waitUntil: 'domcontentloaded' });
// Ordningen är senast ändrad först, så raden för seedens sajt kan ligga var
// som helst — testet skapar egna sajter i senare steg.
const listText = await p.locator('tbody').first().innerText({ timeout: 15000 });
ok('lista renderar', listText.includes('Electricidad'));

// 3. detaljsida + statistikpanel
await p.goto(B+'/admin/sitios/1');
ok('statistikpanel', await p.getByText('Estadísticas').first().isVisible());
ok('statistik har siffror', (await p.locator('body').innerText()).includes('Visitas, 30 días'));

// 4. CRUD: byt namn, verifiera ISR-invalidering på publika sajten
// Slugen läses ur formuläret: testet har kanske bytt den i en tidigare körning.
const currentSlug = await p.locator('input[name=slug]').inputValue();
// Spara-knappen måste sökas INUTI businessformuläret: mediarutnätet har egna
// spara-knappar för alt-texter, och de dyker upp först när en bild finns.
const businessForm = p.locator('form').filter({ has: p.locator('input[name=slug]') });
const save = () => businessForm.getByRole('button', { name: /Guardar/ }).first().click();
const newName = 'Electricidad Mendoza '+Date.now().toString().slice(-5);
await p.fill('input[name=name]', newName);
await save();
await p.waitForTimeout(3000);
const pub = await (await fetch(B+'/'+currentSlug)).text();
ok('CRUD sparar + ISR invalideras', pub.includes(newName));

// 4b. R3-39: adminet sparar det kunden får skriva (tjänstenamn upp till 120
// tecken), nästlade fel syns och det inskrivna ligger kvar efter felet.
await p.goto(B+'/admin/sitios/1');
await p.waitForLoadState('networkidle');
const svcName = businessForm.locator('input[name="service.name"]').first();
const svcDesc = businessForm.locator('input[name="service.desc"]').first();
const origSvcName = await svcName.inputValue();
const origSvcDesc = await svcDesc.inputValue();
const longSvc = 'Instalación completa '.padEnd(110, 'x');
await svcName.fill(longSvc);
await save();
await p.waitForTimeout(3000);
const pubLong = await (await fetch(B+'/'+currentSlug)).text();
ok('admin sparar tjänst med 110 tecken', pubLong.includes(longSvc));
await p.goto(B+'/admin/sitios/1');
await p.waitForLoadState('networkidle');
// maxLength stoppar 301 tecken i webbläsaren — ta bort den för att nå servern.
await svcDesc.evaluate((el) => el.removeAttribute('maxlength'));
await svcDesc.fill('d'.repeat(301));
const typedName = 'Nombre tipeado '+Date.now().toString().slice(-4);
await p.fill('input[name=name]', typedName);
await save();
await p.waitForTimeout(2500);
const errText = await businessForm.innerText();
ok('nästlat tjänstefel visas', /Servicio 1 .*Max 300/.test(errText), errText.match(/Servicio 1[^\n]*/)?.[0] ?? 'inget');
ok('namnet ligger kvar efter felet', (await p.locator('input[name=name]').inputValue()) === typedName);
ok('tjänsten ligger kvar efter felet', (await svcName.inputValue()) === longSvc);
await svcName.fill(origSvcName);
await svcDesc.fill(origSvcDesc);
await p.fill('input[name=name]', newName);
await save();
await p.waitForTimeout(3000);
ok('tjänsten återställd', !(await (await fetch(B+'/'+currentSlug)).text()).includes(longSvc));

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
// Business 1 är publicerad: en giltig länk leder till den riktiga sidan i
// stället för "no es visible al público" (R3-41). Utkastens preview täcks av
// presentation.mjs.
const prev = await fetch(B+previewUrl.pathname+previewUrl.search, { redirect: 'manual' });
const prevLoc = prev.headers.get('location') ?? '';
ok('preview-länk på publicerad sajt ⇒ 307 till publika sidan', prev.status === 307 && new URL(prevLoc, B).pathname === '/' + newSlug, `${prev.status} → ${prevLoc}`);
const pubHome = await (await fetch(B + '/' + newSlug)).text();
ok('startsidan har ett <main>', (pubHome.match(/<main[\s>]/g) ?? []).length === 1);
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
// Baslinjen av business 1:s media före körningens uppladdningar. Städningen i
// slutet raderar allt som inte fanns här, annars växer fotoantalet med fyra per
// körning tills fototaket (20) nekar tenant-testet nedan (R3-12).
const mediaIdsOnAdmin = () =>
  p.locator('form', { has: p.getByRole('button', { name: 'Eliminar', exact: true }) })
    .locator('input[name=mediaId]').evaluateAll((els) => els.map((el) => el.value));
const baselineMedia = new Set(await mediaIdsOnAdmin());
// Uttryckligen fotouppladdaren: betalningsformuläret har ett eget
// input[type=file] för kvitton, och det ligger före bildrutan på sidan.
await p.locator('input[name=photo]').first().setInputFiles({ name: 'smoke.jpg', mimeType: 'image/jpeg', buffer: jpeg });
await p.waitForTimeout(5000);
const detail = await p.locator('body').innerText();
ok('uppladdning syns i admin', /Logo|Fotos/.test(detail));
const imgSrc = await p.locator('img[src^="/media/"]').first().getAttribute('src').catch(() => null);
ok('media-URL genererad', Boolean(imgSrc), imgSrc ?? 'ingen');
if (imgSrc) {
  const media = await fetch(B + imgSrc);
  ok('media serveras med immutable-cache', media.status === 200 && (media.headers.get('cache-control') ?? '').includes('immutable'), `${media.status} ${media.headers.get('cache-control')}`);
}

// 7b. R3-42: byte av logga raderar den gamla loggans filer, två gånger i rad.
const logoPng = (r) => sharp({ create: { width: 300, height: 300, channels: 4, background: { r, g: 40, b: 40, alpha: 1 } } }).png().toBuffer();
const uploadLogo = async (buf) => {
  await p.goto(B + '/admin/sitios/1');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1000);
  await p.locator('input[name=logo]').first().setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: buf });
  await p.waitForTimeout(4000);
  await p.goto(B + '/admin/sitios/1');
  return p.locator('img[src*="-logo.png"]').first().getAttribute('src').catch(() => null);
};
const logoA = await uploadLogo(await logoPng(10));
const logoBBuf = await logoPng(200);
const logoB = await uploadLogo(logoBBuf);
ok('ny logga serveras', Boolean(logoB) && logoB !== logoA && (await fetch(B + logoB)).status === 200, `${logoA} → ${logoB}`);
ok('gamla loggans fil raderas', Boolean(logoA) && (await fetch(B + logoA)).status === 404);
const logoB2 = await uploadLogo(logoBBuf);
ok('samma bild igen: ny fil serveras, den förra raderas', Boolean(logoB2) && logoB2 !== logoB && (await fetch(B + logoB2)).status === 200 && (await fetch(B + logoB)).status === 404);

// 7c. R3-42: ?next= efter inloggning, och ingen öppen redirect.
{
  const anon = await b.newContext();
  const ap = await anon.newPage();
  await ap.goto(B + '/admin/pagos');
  ok('utloggad /admin/pagos ⇒ login med next', new URL(ap.url()).searchParams.get('next') === '/admin/pagos', ap.url());
  const { EMAIL, PASS } = await import('../tests/smoke/_lib.mjs');
  await ap.fill('input[name=email]', EMAIL);
  await ap.fill('input[name=password]', PASS);
  await ap.click('button[type=submit]');
  await ap.waitForURL((u) => !u.pathname.startsWith('/admin/login'), { timeout: 30000 }).catch(() => {});
  ok('efter inloggning tillbaka till /admin/pagos', new URL(ap.url()).pathname === '/admin/pagos', ap.url());
  for (const evil of ['//evil.example', '/\\evil.example', 'https://evil.example/admin']) {
    await ap.goto(B + '/admin/login?next=' + encodeURIComponent(evil));
    const u = new URL(ap.url());
    ok('next=' + evil + ' stannar på sajten', u.origin === new URL(B).origin && u.pathname === '/admin', ap.url());
  }
  await anon.close();
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
await subForm.getByRole('button', { name: /Guardar suscripción/ }).click();
await p.waitForTimeout(2500);
ok('prenumeration sparad', (await p.locator('body').innerText()).includes('450.000'));

const payForm = p.locator('form').filter({ has: p.locator('select[name=method]') });
// R3-36: förvalet är NÄSTA period (där nuvarande slutar + ett år), inte den
// nuvarande — annars förlängde en bekräftad förnyelse ingenting.
await p.reload({ waitUntil: 'domcontentloaded' });
ok(
  'betalningens förvalda period är nästa period',
  (await payForm.locator('input[name=periodStart]').inputValue()) === day(10) &&
    (await payForm.locator('input[name=periodEnd]').inputValue()) === day(375),
);
const ref = 'OP-' + Date.now().toString().slice(-6);
await payForm.locator('input[name=amountGs]').fill('450000');
await payForm.locator('select[name=method]').selectOption('transferencia');
await payForm.locator('input[name=reference]').fill(ref);
await payForm.locator('input[name=periodStart]').fill(day(10));
await payForm.locator('input[name=periodEnd]').fill(day(375));
await payForm.locator('input[name=receipt]').setInputFiles({ name: 'comprobante.jpg', mimeType: 'image/jpeg', buffer: jpeg });
await payForm.getByRole('button', { name: /Registrar pago/ }).click();
await p.waitForTimeout(3500);
const afterPay = await p.locator('body').innerText();
ok('betalning registrerad som rapporterad', afterPay.includes(ref) && afterPay.includes('Reportado'));

await p.goto(B + '/admin/pagos', { waitUntil: 'domcontentloaded' });
const cobros = await p.locator('body').innerText();
ok('betalningen syns i Cobros-kön', cobros.includes(ref));
// Rubriken renderas versaliserad av CSS, så innerText ger "VENCEN PRONTO".
ok('sajten syns i Vencen pronto', /vencen pronto/i.test(cobros) && /en \d+ días/.test(cobros));

await p.locator('form').filter({ has: p.locator(`input[value="/admin/pagos"]`) }).first()
  .getByRole('button', { name: 'Confirmar' }).click();
await p.waitForTimeout(3000);
const confirmed = await p.locator('body').innerText();
ok('bekräftelse kvitteras', confirmed.includes('El pago está confirmado'));

await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
const afterConfirm = await p.locator('body').innerText();
ok('prenumerationen förlängd till betalningens periodslut', afterConfirm.includes(day(375)));
ok('betalningen står som bekräftad', afterConfirm.includes('Confirmado'));

// 9. analytics: beacon på publicerad sajt, avvisad på opublicerad
const send = (bid, ua) => fetch(B+'/api/ev', {method:'POST', headers:{'content-type':'application/json','user-agent':ua}, body: JSON.stringify({b:bid,t:'whatsapp_click',l:'hero',p:'/smoke'})});
ok('beacon svarar 204', (await send(1,'Mozilla/5.0 (iPhone)')).status === 204);
// Per-CTA (R3-18): klicket med l:'hero' syns som "WhatsApp · portada" i adminet.
await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1000);
{
  const t = await p.locator('body').innerText();
  ok('adminet visar klick per knapp', /Clics por botón/i.test(t) && t.includes('WhatsApp · portada'));
}

// 10. intake: länk → kundformulär utan inloggning → foto via token → OTP → inlämning
await p.goto(B + '/admin/alta', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1000);
const negocio = 'Panadería Smoke ' + Date.now().toString().slice(-4);
await p.fill('input[name=name]', negocio);
await p.fill('input[name=phone]', '0985 334 221');
await p.getByRole('button', { name: /Crear enlace/ }).click();
await p.waitForTimeout(2500);
ok('intake-länk skapad', (await p.locator('body').innerText()).includes(negocio));

const intakeUrl = await p.locator('button[title^="http"]').first().getAttribute('title');
const token = (intakeUrl ?? '').split('/alta/')[1] ?? '';
ok('token utdelad', /^[0-9a-f]{32}$/.test(token));

const cust = await b.newPage();
await cust.goto(B + '/alta/' + token, { waitUntil: 'domcontentloaded' });
await cust.waitForTimeout(800);
ok('kundformuläret öppnas utan inloggning', (await cust.locator('h1').innerText()).includes('Panader'));

// R3-38: ett fel från servern ska inte radera det kunden skrev.
await cust.fill('textarea[name=rawDescription]', 'Pan rico');
await cust.fill('input[name="service.0.name"]', 'Pan casero');
await cust.fill('input[name=city]', 'Luque');
await cust.getByRole('button', { name: /Guardar y seguir/ }).click();
await cust.waitForTimeout(2500);
ok(
  'intakens fel behåller texten',
  (await cust.locator('.panel-note--err').count()) > 0 &&
    (await cust.locator('textarea[name=rawDescription]').inputValue()) === 'Pan rico' &&
    (await cust.locator('input[name="service.0.name"]').inputValue()) === 'Pan casero',
);

await cust.fill(
  'textarea[name=rawDescription]',
  'Panadería de barrio con pan casero, facturas y tortas por encargo. Atendemos todos los días desde temprano.',
);
await cust.fill('input[name="service.0.name"]', 'Pan casero');
await cust.fill('input[name="service.1.name"]', 'Tortas por encargo');
await cust.fill('input[name=whatsappPhone]', '0985 334 221');
await cust.fill('input[name=city]', 'Luque');
// Siesta (R3-19): måndagen delas i två pass. Mañana kortas till 12:00 av
// knappen, tarde får 15:00–19:00 som förval.
await cust.getByRole('button', { name: 'Corta al mediodía' }).first().click();
ok('delat pass: mañana kortas till 12:00', (await cust.locator('input[name="hours.mon.close"]').inputValue()) === '12:00');
await cust.getByRole('button', { name: /Guardar y seguir/ }).click();
await cust.waitForTimeout(2500);
ok('steg 1 sparat', cust.url().includes('paso=fotos'));

await cust.goto(B + '/alta/' + token, { waitUntil: 'domcontentloaded' });
await cust.waitForTimeout(800);
ok(
  'delat pass sparat och visas igen',
  (await cust.locator('input[name="hours.mon.close"]').inputValue()) === '12:00' &&
    (await cust.locator('input[name="hours.mon.1.open"]').inputValue().catch(() => '')) === '15:00' &&
    (await cust.locator('input[name="hours.mon.1.close"]').inputValue().catch(() => '')) === '19:00',
);
await cust.goto(B + '/alta/' + token + '?paso=fotos', { waitUntil: 'domcontentloaded' });

await cust.waitForLoadState('networkidle');
await cust.waitForTimeout(1200);
await cust.locator('input[type=file]').last().setInputFiles({ name: 'pan.jpg', mimeType: 'image/jpeg', buffer: jpeg });
await cust.waitForTimeout(4000);
ok('foto uppladdat via intake-token', (await cust.locator('.panel-photos img').count()) > 0);

// R3-33: token går före sessionen. Superadmin (inloggad i `p`) som laddar upp
// med intake-token hamnar på tokens business, inte på "Ogiltigt businessId".
const withSession = await p.evaluate(async ({ bytes, token }) => {
  const body = new FormData();
  body.set('kind', 'photo');
  body.set('token', token);
  body.set('file', new File([new Uint8Array(bytes)], 'sesion.jpg', { type: 'image/jpeg' }));
  const res = await fetch('/api/upload', { method: 'POST', body });
  return res.status;
}, { bytes: [...jpeg], token });
ok('uppladdning med token och inloggad session går till tokens business', withSession === 200, String(withSession));

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
await p.getByRole('button', { name: 'Generar código' }).first().click();
await p.waitForTimeout(2500);
const code = ((await p.locator('body').innerText()).match(/\b\d{6}\b/) || [])[0];
ok('OTP-kod genererad och visad en gång för admin', Boolean(code));

// R3-33: koden gäller numret den skickades till. Kunden byter nummer ⇒ koden
// verifierar inte det nya; tillbaka till rätt nummer ⇒ koden fungerar igen.
const setIntakePhone = async (phone) => {
  await cust.goto(B + '/alta/' + token, { waitUntil: 'domcontentloaded' });
  await cust.waitForTimeout(800);
  await cust.fill('input[name=whatsappPhone]', phone);
  await cust.getByRole('button', { name: /Guardar y seguir/ }).click();
  await cust.waitForTimeout(2500);
  await cust.goto(B + '/alta/' + token + '?paso=verificacion', { waitUntil: 'domcontentloaded' });
  await cust.waitForTimeout(1000);
};
await setIntakePhone('0985 334 299');
await cust.fill('input[name=code]', code ?? '');
await cust.getByRole('button', { name: /Verificar/ }).click();
await cust.waitForTimeout(2000);
ok('koden verifierar inte ett annat nummer', (await cust.locator('body').innerText()).includes('no hay un código activo'));
await setIntakePhone('0985 334 221');

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
if (/sin cuenta de dueño/i.test(await p.locator('body').innerText())) {
  await p.getByRole('button', { name: 'Crear cuenta' }).first().click();
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
ok('admin ser att kunden väntar på kod', (await p.locator('body').innerText()).includes('en espera de un código'));
await p.getByRole('button', { name: 'Generar código' }).first().click();
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

// Kundens egen betalningsrapport (R3-21, PR-19b): metod + referens + kvitto ⇒
// `reported`, bekräftas i adminets befintliga kö och förlänger planen.
const planCard = owner.locator('#plan');
const planText = await planCard.innerText().catch(() => '');
ok('owner ser sin plan', /Tu plan/i.test(planText));
const venceAntes = (planText.match(/vence el (\d{2}\/\d{2}\/\d{4})/) || [])[1] ?? null;
const ownerRef = 'OWN-' + Date.now().toString().slice(-6);
await planCard.locator('select[name=method]').selectOption('tigo_money');
await planCard.locator('input[name=reference]').fill(ownerRef);
// R3-32: ett belopp med tusentalspunkter och en kvittobild över Nexts gamla
// 1 MB-tak för serveråtgärder — en vanlig mobilbild av en överföring.
await planCard.locator('input[name=amountGs]').fill('300.000');
const bigReceipt = await sharp({
  create: { width: 2400, height: 1800, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 60 } },
}).jpeg({ quality: 95 }).toBuffer();
ok('kvittot är större än 1 MB', bigReceipt.length > 1.5 * 1024 * 1024);
await planCard.locator('input[name=receipt]').setInputFiles({ name: 'tigo.jpg', mimeType: 'image/jpeg', buffer: bigReceipt });
await planCard.getByRole('button', { name: 'Informar pago' }).click();
await owner.waitForTimeout(3500);
ok('owner-rapporten kvitteras', /Recibimos tu pago|Lo estamos revisando/.test(await planCard.innerText()));
await owner.reload({ waitUntil: 'domcontentloaded' });
ok('en rapport i taget: formuläret är borta', (await planCard.locator('form').count()) === 0);

await p.goto(B + '/admin/pagos', { waitUntil: 'domcontentloaded' });
const ownerRow = p.locator('tr').filter({ hasText: ownerRef }).first();
ok('rapporten ligger i Cobros-kön', (await ownerRow.count()) > 0);
ok('"300.000" sparas som ₲ 300.000, inte ₲ 300', /300\.000/.test(await ownerRow.innerText()));
await ownerRow.getByRole('button', { name: 'Confirmar' }).click();
await p.waitForTimeout(3000);
await owner.reload({ waitUntil: 'domcontentloaded' });
const venceDespues = ((await planCard.innerText()).match(/vence el (\d{2}\/\d{2}\/\d{4})/) || [])[1] ?? null;
ok('bekräftad rapport förlänger planen ett år', Boolean(venceAntes && venceDespues) && venceDespues !== venceAntes,
  `${venceAntes} → ${venceDespues}`);
ok('formuläret är tillbaka efter bekräftelsen', (await planCard.locator('form').count()) === 1);

// Tu año en cifras (R3-23): länken i owner-panelen bär token; utan den 404.
const reportHref = await owner.getByRole('link', { name: /Ver tu año en cifras/ }).getAttribute('href').catch(() => null);
ok('owner har en länk till årsrapporten', Boolean(reportHref) && /^\/reporte\/[^/?]+\?t=[0-9a-f]{24}$/.test(reportHref ?? ''));
if (reportHref) {
  const report = await (await fetch(B + reportHref)).text();
  ok('årsrapporten öppnas utan inloggning', report.includes('Tu año en cifras') && report.includes('Contactos por WhatsApp'));
  ok('årsrapporten är noindex', /<meta name="robots" content="noindex, nofollow"/.test(report));
  ok('fel token ger 404', (await fetch(B + reportHref.replace(/t=.*/, 't=' + '0'.repeat(24)))).status === 404);
}

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

const modulesCardFor = (page) => page.locator('section').filter({ hasText: /módulos/i }).last();
const galleryRowFor = (page) => modulesCardFor(page).locator('li').filter({ hasText: 'gallery' }).first();

await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
ok('modulpanelen finns i admin', await modulesCardFor(p).getByText('gallery').first().isVisible());
ok('obyggda moduler flaggas som obyggda', /todavía no está/i.test(await modulesCardFor(p).innerText()));

// Utgångsläget beror på seeden och på tidigare körningar — nolla det först.
if ((await galleryRowFor(p).innerText()).includes('Desactivar')) {
  await galleryRowFor(p).getByRole('button', { name: 'Desactivar' }).click();
  await p.waitForTimeout(2500);
  await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
}
const galleryOffText = await galleryRowFor(p).innerText();
ok('galleriet är av', galleryOffText.includes('Activar'));
ok('fototaket visar basplanen', galleryOffText.includes('/8'), galleryOffText.replace(/\n/g, ' | '));

await galleryRowFor(p).getByRole('button', { name: 'Activar' }).click();
await p.waitForTimeout(2500);
await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const galleryOnText = await galleryRowFor(p).innerText();
ok('galleriet slås på', galleryOnText.includes('Desactivar'));
ok('aktiveringsdatum registreras', galleryOnText.includes('Activado'));
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

// Körbar två gånger mot samma databas (R3-12): blocket städar efter sig i slutet,
// men en databas från en äldre körning kan ha modulen på. Stäng av den först så
// att "syns inte utan modulen" alltid mäter samma utgångsläge som en färsk seed.
await p.goto(B + '/admin/sitios/' + ownerBizId, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const menuRow = () => modulesCardFor(p).locator('li').filter({ hasText: 'menu' }).first();
if ((await menuRow().innerText()).includes('Desactivar')) {
  await menuRow().getByRole('button', { name: 'Desactivar' }).click();
  await p.waitForTimeout(2500);
}
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
await owner.waitForTimeout(1200);
ok('menyn syns inte utan modulen', !(await owner.locator('body').innerText()).includes('Tu carta'));

await p.goto(B + '/admin/sitios/' + ownerBizId, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
ok('menyn är byggd och märks inte som obyggd', !/todavía no está/i.test(await menuRow().innerText()));
if ((await menuRow().innerText()).includes('Activar')) {
  await menuRow().getByRole('button', { name: 'Activar' }).click();
  await p.waitForTimeout(2500);
}

await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
await owner.waitForTimeout(1500);
ok('menyredigeraren dyker upp med modulen', (await owner.locator('body').innerText()).includes('Tu carta'));

const run14 = Date.now().toString().slice(-4);
const seccion = 'Entradas ' + run14;
const empanada = 'Empanada de carne ' + run14;
const pescado = 'Pescado del día ' + run14;
const fantasma = 'Plato fantasma ' + run14;
// Sektionens namn står bara i inputens value/aria-label, inte som text.
const seccionBox = () =>
  owner.locator('.panel-menu-section').filter({ has: owner.getByLabel('Nombre de la sección ' + seccion, { exact: true }) });
await owner.fill('#new-section', seccion);
await owner.getByRole('button', { name: 'Agregar sección' }).click();
await owner.waitForTimeout(3000);
ok('sektion skapad', (await owner.locator('body').innerText()).includes(seccion));

// En rätt med pris och en utan: tomt prisfält ska bli "A consultar", inte 0.
await seccionBox().getByRole('button', { name: new RegExp('Agregar plato a') }).click();
await owner.waitForTimeout(600);
await seccionBox().locator('.panel-menu-form input[name=name]').fill(empanada);
await seccionBox().locator('.panel-menu-form input[name=priceGs]').fill('8000');
await seccionBox().getByRole('button', { name: 'Agregar plato', exact: true }).click();
await owner.waitForTimeout(3000);
const menuText = await owner.locator('body').innerText();
ok('plato med pris sparat', menuText.includes(empanada) && menuText.includes('8.000'));

await seccionBox().getByRole('button', { name: new RegExp('Agregar plato a') }).click();
await owner.waitForTimeout(600);
await seccionBox().locator('.panel-menu-form input[name=name]').fill(pescado);
await seccionBox().locator('.panel-menu-form input[name=priceGs]').fill('');
await seccionBox().getByRole('button', { name: 'Agregar plato', exact: true }).click();
await owner.waitForTimeout(3000);
ok('tomt pris blir "A consultar"', (await owner.locator('body').innerText()).includes('A consultar'));

const ownerSlug14 = ((await owner.locator('.panel-top a').first().getAttribute('href').catch(() => null)) ?? '').split('/').pop();
if (ownerSlug14) {
  const html = await (await fetch(B + '/' + ownerSlug14)).text();
  ok('menyn syns på publika sajten (ISR)', html.includes(empanada) && html.includes(seccion));
  ok('menyn skickar menu_view', html.includes('data-ev-view="menu_view"'));
}

// Bild på en rätt (R3-16): upp från panelen, ut på sajten; raderas med
// sektionen i städningen nedan.
await owner.waitForLoadState('networkidle');
await seccionBox().locator('.panel-menu-items li').filter({ hasText: pescado })
  .locator('.panel-item-image input[type=file]')
  .setInputFiles({ name: 'pescado.jpg', mimeType: 'image/jpeg', buffer: jpeg });
await owner.waitForTimeout(3500);
const dishImg = await seccionBox().locator('.panel-menu-items li').filter({ hasText: pescado })
  .locator('.panel-item-image img').getAttribute('src').catch(() => null);
ok('bild på rätten uppladdad', Boolean(dishImg) && (await fetch(B + dishImg)).status === 200, dishImg ?? '');
if (ownerSlug14) {
  const html = await (await fetch(B + '/' + ownerSlug14)).text();
  ok('rättens bild syns på sajten', html.includes('site-menu-item-img') && html.includes(dishImg ?? '§'));
}

// "No hay hoy": rätten ska bort från sajten men ligga kvar i panelen — annars
// måste kunden skriva in den på nytt i morgon.
await seccionBox().locator('.panel-menu-items li').filter({ hasText: empanada })
  .getByRole('button', { name: 'No hay hoy' }).click();
await owner.waitForTimeout(3000);
ok('slutsåld rätt ligger kvar i panelen', (await owner.locator('body').innerText()).includes(empanada));
if (ownerSlug14) {
  const html = await (await fetch(B + '/' + ownerSlug14)).text();
  ok('slutsåld rätt döljs på sajten', !html.includes(empanada));
}

// Modulen av: menyn försvinner från sajten, men datat ligger kvar och kommer
// tillbaka när den slås på igen. Owner-sidan lämnas medvetet öppen — nästa
// kontroll använder den som en gammal flik.
await seccionBox().getByRole('button', { name: new RegExp('Agregar plato a') }).click();
await owner.waitForTimeout(600);
await seccionBox().locator('.panel-menu-form input[name=name]').fill(fantasma);

await p.goto(B + '/admin/sitios/' + ownerBizId, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await menuRow().getByRole('button', { name: 'Desactivar' }).click();
await p.waitForTimeout(2500);
if (ownerSlug14) {
  const html = await (await fetch(B + '/' + ownerSlug14)).text();
  ok('avstängd modul döljer menyn', !html.includes(seccion));
}

// Serveråtgärden måste neka posten från den gamla fliken. Modulkontrollen
// ligger i menuContext(), inte i att knappen inte renderas.
await seccionBox().getByRole('button', { name: 'Agregar plato', exact: true }).click();
await owner.waitForTimeout(3000);
ok(
  'avstängd modul nekar posten från en gammal flik',
  (await owner.locator('body').innerText()).includes('No pudimos guardar'),
);

await p.goto(B + '/admin/sitios/' + ownerBizId, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await menuRow().getByRole('button', { name: 'Activar' }).click();
await p.waitForTimeout(2500);
if (ownerSlug14) {
  const html = await (await fetch(B + '/' + ownerSlug14)).text();
  ok('avstängning raderar inte menyn', html.includes(seccion));
  ok('den nekade rätten skrevs aldrig', !html.includes(fantasma));
}

// Städning (R3-12): radera sektionen och stäng av modulen igen, så att nästa
// körning mot samma databas börjar i seedens läge och sektionstaket (12) inte
// fylls på av gamla körningar.
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
await owner.waitForTimeout(1500);
// R3-40: första trycket frågar, andra raderar.
await seccionBox().getByRole('button', { name: 'Borrar sección' }).click();
await owner.waitForTimeout(800);
ok('Borrar sección frågar först', (await owner.locator('body').innerText()).includes(seccion));
await seccionBox().getByRole('button', { name: /^Sí, borrar la sección/ }).click();
await owner.waitForTimeout(2500);
ok('testsektionen städas bort', !(await owner.locator('body').innerText()).includes(seccion));
ok('rättens bild raderas med sektionen', !dishImg || (await fetch(B + dishImg)).status === 404);
await p.goto(B + '/admin/sitios/' + ownerBizId, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await menuRow().getByRole('button', { name: 'Desactivar' }).click();
await p.waitForTimeout(2500);

// 15. extra_pages (R3-25): admin skapar en sida, owner skriver texten, sajten
// länkar till och serverar den, sitemapen listar den; dold sida och avstängd
// modul ⇒ 404. Städas bort i slutet så att nästa körning börjar från seeden.
const run15 = Date.now().toString().slice(-5);
const pagesRow = () => modulesCardFor(p).locator('li').filter({ hasText: 'extra_pages' }).first();
const pagesCard = () => p.locator('section').filter({ hasText: /Páginas adicionales/ }).last();
const nosotrosLi = () => pagesCard().locator('li[data-page-slug="nosotros"]');
const adminBiz = async () => {
  await p.goto(B + '/admin/sitios/' + ownerBizId, { waitUntil: 'domcontentloaded' });
  await p.waitForLoadState('networkidle');
};

await adminBiz();
ok('extra_pages är byggd och märks inte som obyggd', !/todavía no está/i.test(await pagesRow().innerText()));
if ((await pagesRow().innerText()).includes('Activar')) {
  await pagesRow().getByRole('button', { name: 'Activar' }).click();
  await p.waitForTimeout(2500);
  await adminBiz();
}
// En kraschad tidigare körning kan ha lämnat sidan kvar.
if ((await nosotrosLi().count()) > 0) {
  await nosotrosLi().getByRole('button', { name: 'Borrar página' }).click();
  await p.waitForTimeout(2500);
}
await pagesCard().locator('select[name=type]').selectOption('nosotros');
await pagesCard().getByRole('button', { name: 'Crear página' }).click();
await p.waitForTimeout(3000);
ok('admin skapar /nosotros', (await nosotrosLi().count()) === 1);

await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
await owner.waitForLoadState('networkidle');
const ownerPageForm = owner.locator('form[data-page-slug="nosotros"]');
ok('owner ser sidan och kan skriva texten', (await ownerPageForm.count()) === 1);
ok('owner kan inte skapa sidor', !(await owner.locator('body').innerText()).includes('Crear página'));
await ownerPageForm.locator('textarea[name=body]').fill(
  'Somos una empresa familiar ' + run15 + '.\n\nAtendemos desde 1998.',
);
await ownerPageForm.getByRole('button', { name: 'Guardar página' }).click();
await owner.waitForTimeout(3000);
ok('owner sparar sidans text', (await ownerPageForm.innerText()).includes('¡Guardado!'));

const subUrl = B + '/' + ownerSlug14 + '/nosotros';
const home15 = await (await fetch(B + '/' + ownerSlug14)).text();
ok('startsidan länkar till /nosotros', home15.includes(`href="/${ownerSlug14}/nosotros"`));
const sub15 = await fetch(subUrl);
const subHtml = await sub15.text();
ok(
  '/nosotros svarar 200 med ownerns text i stycken',
  sub15.status === 200 && subHtml.includes('Somos una empresa familiar ' + run15) && subHtml.includes('<p>Atendemos desde 1998.</p>'),
);
ok('/nosotros har egen canonical', subHtml.includes(`rel="canonical" href="${new URL(B).origin}`) || subHtml.includes(`/${ownerSlug14}/nosotros"`));
ok('sitemapen listar /nosotros', (await (await fetch(B + '/sitemap.xml')).text()).includes(`/${ownerSlug14}/nosotros</loc>`));
ok('okänd sida ⇒ 404', (await fetch(B + '/' + ownerSlug14 + '/no-existe')).status === 404);

// Dölj sidan i adminet.
await adminBiz();
await nosotrosLi().locator('input[name=isEnabled]').uncheck();
await nosotrosLi().getByRole('button', { name: 'Guardar página' }).click();
await p.waitForTimeout(3000);
ok('dold sida ⇒ 404', (await fetch(subUrl)).status === 404);
ok('dold sida länkas inte', !(await (await fetch(B + '/' + ownerSlug14)).text()).includes(`/${ownerSlug14}/nosotros"`));
await nosotrosLi().locator('input[name=isEnabled]').check();
await nosotrosLi().getByRole('button', { name: 'Guardar página' }).click();
await p.waitForTimeout(3000);
ok('synlig igen', (await fetch(subUrl)).status === 200);

// Modulen av: 404, men sidan ligger kvar i databasen.
await adminBiz();
await pagesRow().getByRole('button', { name: 'Desactivar' }).click();
await p.waitForTimeout(2500);
ok('avstängd modul ⇒ 404', (await fetch(subUrl)).status === 404);

// Städning: modulen på för att komma åt sidan, radera, modulen av.
await adminBiz();
await pagesRow().getByRole('button', { name: 'Activar' }).click();
await p.waitForTimeout(2500);
await adminBiz();
await nosotrosLi().getByRole('button', { name: 'Borrar página' }).click();
await p.waitForTimeout(2500);
ok('testsidan städas bort', (await nosotrosLi().count()) === 0);
await pagesRow().getByRole('button', { name: 'Desactivar' }).click();
await p.waitForTimeout(2500);

await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
await p.waitForLoadState('networkidle');
for (let guard = 0; guard < 12; guard++) {
  const extraId = (await mediaIdsOnAdmin()).find((id) => !baselineMedia.has(id));
  if (!extraId) break;
  await p.locator('form', { has: p.locator(`input[name=mediaId][value="${extraId}"]`) })
    .getByRole('button', { name: 'Eliminar', exact: true }).click();
  await p.waitForTimeout(2000);
}
ok('körningens foton städas bort', (await mediaIdsOnAdmin()).every((id) => baselineMedia.has(id)));

await finish(b, failed());
