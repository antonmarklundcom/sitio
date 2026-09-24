/**
 * Rök för tillväxtpaketet (growth-1, docs/log/growth-1.md): consultas och
 * turnos från kundsajten, ägarens inkorg och av/på-val, värvning med bonus,
 * säljare med provision, "Me interesa", meddelandekön och autopublicering.
 *
 * Egen fil, egen inloggning. Läser och skriver MySQL direkt (DATABASE_URL ur
 * .env.local) för det UI:t inte kan göra snabbt: ett verifierat nummer, en
 * betalning att bekräfta, förra månadens statistik. Allt annat går genom
 * riktiga sidor. Kör aldrig mot produktion.
 *
 * Egen X-Forwarded-For per browserkontext: registro har 5/h per IP och
 * registro.mjs räknar själv till sex — den här sviten får inte äta av den.
 */
import { config } from 'dotenv';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import { B, adminLogin, createChecker, finish, launchBrowser } from './_lib.mjs';

config({ path: '.env.local' });
config();
const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: 'Z' });
const q = async (sql, args = []) => (await db.query(sql, args))[0];

const b = await launchBrowser();
const p = await b.newPage();
const { ok, failed } = createChecker();
await adminLogin(p, ok, b);

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date());
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayOf = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const ctx = async (ip) => b.newContext({ extraHTTPHeaders: { 'x-forwarded-for': ip } });

// Utgångsläge: ingen autopublicering, standardvärden.
await q("delete from settings where `key` in ('growth','upsells')");

// ---------- 1. owner-inloggning för business 1 ----------
await p.goto(B + '/admin/accesos', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
if (/sin cuenta de dueño/i.test(await p.locator('body').innerText())) {
  await p.getByRole('button', { name: 'Crear cuenta' }).first().click();
  await p.waitForTimeout(3000);
  await p.goto(B + '/admin/accesos', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
}
const ownerPhone = (await p.locator('table tbody tr').first().locator('td').nth(1).innerText()).replace(/\s/g, '');
const [ownerUser] = await q('select b.id as businessId from businesses b join users u on u.id = b.owner_user_id where u.phone = ?', [ownerPhone]);
const bizId = ownerUser?.businessId;
ok('owner-konto finns', Boolean(bizId));
const owner = await (await ctx('10.9.0.1')).newPage();
await owner.goto(B + '/mi-sitio/login', { waitUntil: 'domcontentloaded' });
await owner.fill('input[name=phone]', ownerPhone);
await owner.getByRole('button', { name: /Pedir código/ }).click();
await owner.waitForTimeout(2000);
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Generar código' }).first().click();
await p.waitForTimeout(2500);
const ownerCode = ((await p.locator('body').innerText()).match(/\b\d{6}\b/) || [])[0];
await owner.fill('input[name=code]', ownerCode ?? '');
await owner.getByRole('button', { name: 'Entrar' }).click();
await owner.waitForTimeout(3000);
ok('owner-inloggning ok', owner.url().endsWith('/mi-sitio'));

const [biz] = await q('select slug, name, referral_code as code from businesses where id = ?', [bizId]);
await q("update businesses set status = 'published', site_options_json = null, google_review_url = null where id = ?", [bizId]);
await q("delete from business_modules where business_id = ? and module_key = 'booking'", [bizId]);
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
const panel = await owner.locator('body').innerText();
ok('panelen visar Consultas, Hacé crecer, Recomendá och Opciones', ['Consultas', 'Hacé crecer tu negocio', 'Recomendá y ganá', 'Opciones de tu página'].every((t) => panel.includes(t)));
const [{ code: refCode }] = await q('select referral_code as code from businesses where id = ?', [bizId]);
ok('värvningskod skapad och visad', /^[A-Z0-9]{6}$/.test(refCode ?? '') && panel.includes(`/registro?ref=${refCode}`));

// Nollställningen ovan gick direkt i DB och revaliderar inte ISR-cachen från
// en tidigare körning — spara defaultvalen via panelen så att sidan byggs om.
await owner.locator('#opciones').getByRole('button', { name: 'Guardar opciones' }).click();
await owner.waitForTimeout(1500);

// ---------- 2. consulta från kundsajten ----------
const visitor = await (await ctx('10.9.0.2')).newPage();
await visitor.goto(B + '/' + biz.slug, { waitUntil: 'domcontentloaded' });
ok('formuläret "Dejanos tu número" syns', await visitor.getByText('¿Preferís que te escribamos?').isVisible());
ok('ingen kredit och ingen recensionsknapp som default', !(await visitor.locator('body').innerText()).includes('Hecho con sitio.com.py') && !(await visitor.locator('body').innerText()).includes('reseña'));
await visitor.getByText('¿Preferís que te escribamos?').click();
await visitor.getByRole('button', { name: 'Enviar' }).click();
await visitor.waitForTimeout(1500);
ok('tomt formulär ger fältfel', (await visitor.locator('.lead-err').count()) > 0);
await visitor.fill('.lead-form input[name=name]', 'Ana Benítez');
await visitor.fill('.lead-form input[name=phone]', '0971 555 111');
await visitor.fill('.lead-form textarea[name=message]', '¿Hacen instalaciones en Lambaré?');
await visitor.getByRole('button', { name: 'Enviar' }).click();
await visitor.waitForTimeout(2000);
ok('consultan tas emot', (await visitor.locator('.lead-form--done').innerText()).includes('Recibimos tu consulta'));
ok('besökaren erbjuds WhatsApp efteråt', ((await visitor.locator('.lead-form--done a').getAttribute('href')) ?? '').startsWith('https://wa.me/'));

const post = (body, ip = '10.9.0.3') =>
  fetch(B + '/api/consulta', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });
const beforeHoney = (await q('select count(*) n from site_leads where business_id = ?', [bizId]))[0].n;
const honey = await post({ b: bizId, name: 'Bot', phone: '0981000000', message: 'spam', website: 'x' });
ok('honeypot svarar ok men sparar inget', honey.status === 200 && (await q('select count(*) n from site_leads where business_id = ?', [bizId]))[0].n === beforeHoney);
ok('okänd sajt ger 404', (await post({ b: 999999, name: 'Ana', phone: '0981000000', message: 'hola' })).status === 404);
ok('turno utan booking-modulen nekas', (await post({ b: bizId, kind: 'turno', name: 'Ana', phone: '0981000000', day: addDays(today, 3) })).status === 404);
let limited = 0;
for (let i = 0; i < 6; i++) if ((await post({ b: bizId, name: 'Ana', phone: '0981', message: 'x' }, '10.9.0.4')).status === 429) limited++;
ok('tak per IP (5 per 10 min)', limited === 1, `429 × ${limited}`);

// ---------- 3. inkorgen ----------
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
const inbox = owner.locator('#consultas');
ok('consultan syns i inkorgen som ny', (await inbox.innerText()).includes('Ana Benítez') && (await inbox.innerText()).includes('nuevas'));
const replyHref = (await inbox.locator('a', { hasText: 'Responder por WhatsApp' }).first().getAttribute('href')) ?? '';
ok('svarslänken går till besökarens nummer med text', replyHref.startsWith('https://wa.me/595971555111?text=') && decodeURIComponent(replyHref).includes('Hola Ana!'));
await inbox.getByRole('button', { name: 'Marcar respondida' }).first().click();
await owner.waitForTimeout(1500);
const [lead] = await q('select status from site_leads where business_id = ? order by id desc limit 1', [bizId]);
ok('markerad som besvarad', lead?.status === 'contactado');

// ---------- 4. ägarens av/på-val ----------
const opts = owner.locator('#opciones');
await opts.locator('input[name=googleReviewUrl]').fill('https://evil.example.com/review');
await opts.getByRole('button', { name: 'Guardar opciones' }).click();
await owner.waitForTimeout(1500);
ok('recensionslänk utanför Google avvisas', (await opts.innerText()).includes('Revisá el enlace'));
await opts.locator('input[name=googleReviewUrl]').fill('https://g.page/r/CSmoke123/review');
await opts.locator('input[name=leadForm]').uncheck();
await opts.locator('input[name=credit]').check();
await opts.getByRole('button', { name: 'Guardar opciones' }).click();
await owner.waitForTimeout(2000);
ok('valen sparas', (await opts.innerText()).includes('Guardado'));
await visitor.goto(B + '/' + biz.slug, { waitUntil: 'domcontentloaded' });
const pub = await visitor.locator('body').innerText();
ok('formuläret borta när ägaren stängt av det', !pub.includes('¿Preferís que te escribamos?'));
ok('recensionsknappen syns med länken', ((await visitor.locator('a', { hasText: 'reseña en Google' }).getAttribute('href')) ?? '') === 'https://g.page/r/CSmoke123/review');
ok('krediten länkar till registro med kundens kod', ((await visitor.locator('.footer-credit').getAttribute('href')) ?? '').endsWith(`/registro?ref=${refCode}`));
ok('avstängt formulär tar inte emot via API', (await post({ b: bizId, name: 'Ana', phone: '0981000000', message: 'hola' }, '10.9.0.5')).status === 404);

// ---------- 5. booking (turno) ----------
await q("insert into business_modules (business_id, module_key, is_enabled, enabled_at) values (?, 'booking', 1, now()) on duplicate key update is_enabled = 1", [bizId]);
await p.goto(B + '/admin/sitios/' + bizId, { waitUntil: 'domcontentloaded' });
// Modulväxeln via DB revaliderar inte ISR — spara opciones igen som ägare för att tömma cachen.
await opts.getByRole('button', { name: 'Guardar opciones' }).click();
await owner.waitForTimeout(1500);
await visitor.goto(B + '/' + biz.slug, { waitUntil: 'domcontentloaded' });
ok('turno-formuläret syns med booking på', await visitor.getByText('Pedí tu turno acá').isVisible());
await visitor.fill('.lead-form input[name=name]', 'Carlos Gómez');
await visitor.fill('.lead-form input[name=phone]', '0982 444 333');
await visitor.fill('.lead-form input[name=day]', addDays(today, 2));
await visitor.fill('.lead-form input[name=time]', '10:30');
await visitor.getByRole('button', { name: 'Pedir turno' }).click();
await visitor.waitForTimeout(2000);
ok('turnon tas emot', (await visitor.locator('body').innerText()).includes('Recibimos tu pedido de turno'));
ok('turno bakåt i tiden nekas', (await post({ b: bizId, kind: 'turno', name: 'Ana', phone: '0981000000', day: addDays(today, -1) }, '10.9.0.6')).status === 422);
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
ok('turnon syns i inkorgen med dag och tid', (await owner.locator('#consultas').innerText()).includes('a las 10:30'));
await q("update business_modules set is_enabled = 0 where business_id = ? and module_key = 'booking'", [bizId]);
await q('update businesses set site_options_json = null, google_review_url = null where id = ?', [bizId]);

// ---------- 6. "Me interesa" ----------
await q('delete from service_requests where business_id = ?', [bizId]);
const svc = owner.locator('#crecer');
const firstTitle = await svc.locator('.panel-service h3').first().innerText();
const waNav = owner.waitForRequest((r) => r.url().startsWith('https://wa.me/'), { timeout: 8000 }).catch(() => null);
await svc.getByRole('button', { name: 'Me interesa' }).first().click();
const waReq = await waNav;
ok('"Me interesa" öppnar WhatsApp mot säljnumret', Boolean(waReq) && decodeURIComponent(waReq.url()).includes(firstTitle), waReq?.url().slice(0, 60));
const reqRows = await q('select service_title as t from service_requests where business_id = ?', [bizId]);
ok('förfrågan sparad en gång', reqRows.length === 1 && reqRows[0].t === firstTitle);
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
ok('kortet visar "Ya lo pediste"', (await owner.locator('#crecer').innerText()).includes('Ya lo pediste'));
await p.goto(B + '/admin/leads', { waitUntil: 'domcontentloaded' });
ok('förfrågan syns i /admin/leads', (await p.locator('body').innerText()).includes(firstTitle));

// ---------- 7. värvning: registrering via ?ref= och bonus vid första betalningen ----------
const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 90, g: 120, b: 60 } } }).jpeg().toBuffer();
const rnd = String(Date.now()).slice(-6);
async function register(ref, name, phone, ip) {
  const page = await (await ctx(ip)).newPage();
  await page.goto(B + `/registro?ref=${ref}`, { waitUntil: 'domcontentloaded' });
  const offer = await page.locator('[data-testid=ref-offer]').count();
  await page.fill('input[name=name]', name);
  await page.selectOption('select[name=category]', 'servicios');
  await page.fill('input[name=phone]', phone);
  await page.getByRole('button', { name: 'Crear mi página' }).click();
  await page.waitForURL(/\/alta\//, { timeout: 15000 }).catch(() => {});
  const token = page.url().split('/alta/')[1]?.split('?')[0] ?? '';
  const [row] = await q('select b.id, b.referred_by_business_id as refBiz, b.partner_id as partnerId from onboarding_tokens t join businesses b on b.id = t.business_id where t.token = ?', [token]);
  return { page, token, row, offer };
}
const referred = await register(refCode, `Taller Smoke ${rnd}`, `0983${rnd}`, '10.9.1.1');
ok('?ref= visar erbjudandet', referred.offer === 1);
ok('den värvade kopplas till kunden', referred.row?.refBiz === bizId, JSON.stringify(referred.row));

async function payAndConfirm(businessId, amount) {
  const [sub] = await q('select id from subscriptions where business_id = ? order by id desc limit 1', [businessId]);
  let subId = sub?.id;
  if (!subId) {
    const res = await q("insert into subscriptions (business_id, plan, price_gs, starts_at, expires_at, status) values (?, 'basico', ?, ?, ?, 'active')", [businessId, amount, today, addDays(today, 365)]);
    subId = res.insertId;
  }
  const pay = await q("insert into payments (business_id, subscription_id, amount_gs, method, period_start, period_end, status) values (?, ?, ?, 'transferencia', ?, ?, 'reported')", [businessId, subId, amount, today, addDays(today, 365)]);
  await p.goto(B + '/admin/pagos', { waitUntil: 'domcontentloaded' });
  const row = p.locator('tr', { has: p.locator(`input[name=paymentId][value="${pay.insertId}"]`) });
  await row.getByRole('button', { name: 'Confirmar' }).click();
  await p.waitForTimeout(2500);
  return pay.insertId;
}
// Värvaren behöver en plan att förlänga.
const [refSubBefore] = await q('select id, expires_at as e from subscriptions where business_id = ? order by expires_at desc, id desc limit 1', [bizId]);
let referrerExpiry = refSubBefore ? dayOf(refSubBefore.e) : null;
if (!refSubBefore) {
  await q("insert into subscriptions (business_id, plan, price_gs, starts_at, expires_at, status) values (?, 'basico', 300000, ?, ?, 'active')", [bizId, today, addDays(today, 200)]);
  referrerExpiry = addDays(today, 200);
}
await payAndConfirm(referred.row.id, 300000);
const [refSubAfter] = await q('select expires_at as e from subscriptions where business_id = ? order by expires_at desc, id desc limit 1', [bizId]);
ok('värvaren får 30 dagar', dayOf(refSubAfter.e) === addDays(referrerExpiry, 30), `${referrerExpiry} → ${dayOf(refSubAfter.e)}`);
const [newSub] = await q('select expires_at as e from subscriptions where business_id = ? order by expires_at desc limit 1', [referred.row.id]);
ok('den värvade får 30 extra dagar', dayOf(newSub.e) === addDays(addDays(today, 365), 30), dayOf(newSub.e));
await payAndConfirm(referred.row.id, 300000);
const [refSubAgain] = await q('select expires_at as e from subscriptions where business_id = ? order by expires_at desc, id desc limit 1', [bizId]);
ok('andra betalningen ger ingen ny bonus', dayOf(refSubAgain.e) === dayOf(refSubAfter.e));
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
ok('ägaren ser sin värvning', /Se registraron \d+ con tu enlace · \d+ ya pagaron/.test(await owner.locator('#recomenda').innerText()));

// ---------- 8. säljare: kod, registrering, provision, rapportsida ----------
await p.goto(B + '/admin/socios', { waitUntil: 'domcontentloaded' });
await p.fill('input[name=name]', `Vendedor ${rnd}`);
await p.fill('input[name=phone]', '0984 111 222');
await p.getByRole('button', { name: 'Crear socio' }).click();
await p.waitForTimeout(2000);
const [partner] = await q('select id, code, token, commission_pct as pct from partners where name = ?', [`Vendedor ${rnd}`]);
ok('säljaren skapas med kod och 30 %', Boolean(partner?.code) && partner.pct === 30 && (await p.locator('body').innerText()).includes(partner.code));
const sold = await register(partner.code, `Clinica Smoke ${rnd}`, `0976${rnd}`, '10.9.1.2');
ok('kunden kopplas till säljaren', sold.row?.partnerId === partner.id && sold.row?.refBiz === null);
await payAndConfirm(sold.row.id, 600000);
const commissions = await q('select amount_gs as a, status from partner_commissions where partner_id = ?', [partner.id]);
ok('provision 30 % av 600 000 = 180 000', commissions.length === 1 && Number(commissions[0].a) === 180000);
const partnerPage = await (await ctx('10.9.1.3')).newPage();
await partnerPage.goto(B + `/socio/${partner.token}`, { waitUntil: 'domcontentloaded' });
const pp = await partnerPage.locator('body').innerText();
ok('säljarens sida visar kund och provision', pp.includes(`Clinica Smoke ${rnd}`) && pp.includes('180.000'));
ok('säljarens sida är noindex', ((await partnerPage.locator('meta[name=robots]').first().getAttribute('content')) ?? '').includes('noindex'));
ok('fel token ger 404', (await fetch(B + '/socio/' + '0'.repeat(32))).status === 404);
await p.goto(B + '/admin/socios', { waitUntil: 'domcontentloaded' });
await p.getByRole('button', { name: 'Pagada' }).first().click();
await p.waitForTimeout(1500);
ok('provisionen markeras betald', (await q('select status from partner_commissions where partner_id = ?', [partner.id]))[0].status === 'paid');

// ---------- 9. meddelandekön ----------
const lastMonthDay = (() => {
  const [y, m] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 10)).toISOString().slice(0, 10);
})();
await q('insert into analytics_daily (business_id, day, views, uniques, wa_clicks) values (?, ?, 321, 200, 17) on duplicate key update views = 321, wa_clicks = 17', [bizId, lastMonthDay]);
await q('delete from outbound_messages where business_id = ?', [bizId]);
await q("update subscriptions set expires_at = ?, status = 'active' where business_id = ? order by expires_at desc limit 1", [addDays(today, 10), bizId]);
await p.goto(B + '/admin/mensajes', { waitUntil: 'domcontentloaded' });
const queueText = await p.locator('main').innerText();
ok('kön visar förnyelse 15 dagar', queueText.includes('Renovación · 15 días') && queueText.includes(biz.name));
ok('kön visar månadssiffrorna', queueText.includes('Cifras del mes') && queueText.includes('321 visitas'));
const itemCount = async () => p.locator('li', { hasText: biz.name }).filter({ has: p.getByRole('button', { name: 'Omitir' }) }).count();
const before = await itemCount();
await p.locator('li', { hasText: biz.name }).filter({ has: p.getByRole('button', { name: 'Omitir' }) }).first().getByRole('button', { name: 'Omitir' }).click();
await p.waitForTimeout(2000);
await p.goto(B + '/admin/mensajes', { waitUntil: 'domcontentloaded' });
ok('ett omitterat meddelande försvinner ur kön', (await itemCount()) === before - 1);
ok('och finns bland skickade', (await q('select count(*) n from outbound_messages where business_id = ?', [bizId]))[0].n === 1);

// ---------- 10. autopublicering + provperioden från publiceringen ----------
await p.goto(B + '/admin/crecimiento', { waitUntil: 'domcontentloaded' });
await p.locator('input[name=autoPublish]').check();
await p.getByRole('button', { name: 'Guardar ajustes' }).click();
await p.waitForTimeout(1500);
ok('autopublicering påslagen', JSON.parse((await q("select value from settings where `key` = 'growth'"))[0].value).autoPublish === true);
await q("insert into settings (`key`, value) values ('promo', ?) on duplicate key update value = values(value)", [JSON.stringify({ trialEnabled: true, trialDays: 30, trialPlan: 'plus', bannerText: 'x' })]);
const auto = await register('NONE00', `Peluqueria Smoke ${rnd}`, `0991${rnd}`, '10.9.1.4');
const cust = auto.page;
await cust.fill('textarea[name=rawDescription]', 'Peluquería de barrio con cortes, color y peinados para toda la familia. Atendemos con turno y sin turno, de lunes a sábado, con productos profesionales.');
await cust.fill('input[name="service.0.name"]', 'Corte');
await cust.fill('input[name="service.1.name"]', 'Color');
await cust.getByRole('button', { name: /Guardar y seguir/ }).click();
await cust.waitForTimeout(2500);
const up = new FormData();
up.set('kind', 'photo');
up.set('token', auto.token);
up.set('file', new File([jpeg], 'pelu.jpg', { type: 'image/jpeg' }));
ok('foto uppladdat', (await fetch(B + '/api/upload', { method: 'POST', body: up })).status === 200);
await q('update businesses set whatsapp_verified_at = now() where id = ?', [auto.row.id]);
// Provperioden började "för fem dagar sedan" — publiceringen ska flytta den till idag.
await q('update subscriptions set starts_at = ?, expires_at = ? where business_id = ?', [addDays(today, -5), addDays(today, 25), auto.row.id]);
await cust.goto(B + '/alta/' + auto.token + '?paso=verificacion', { waitUntil: 'domcontentloaded' });
await cust.getByRole('button', { name: /Enviar mis datos/ }).click();
await cust.waitForTimeout(2500);
ok('tacksidan säger att sidan publiceras', (await cust.locator('body').innerText()).includes('se publica en unos minutos'));
let published = null;
for (let i = 0; i < 20 && !published; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  [published] = await q("select slug, needs_review as nr, description from businesses where id = ? and status = 'published'", [auto.row.id]);
}
ok('sajten autopubliceras och hamnar i granskningslistan', Boolean(published) && published.nr === 1);
ok('utan AI-nyckel blir kundens text beskrivningen', (published?.description ?? '').startsWith('Peluquería de barrio'));
const [trial] = await q('select starts_at as s, expires_at as e, status from subscriptions where business_id = ?', [auto.row.id]);
ok('provperioden startar vid publiceringen, samma längd', trial?.status === 'trial' && dayOf(trial.s) === today && dayOf(trial.e) === addDays(today, 30), `${dayOf(trial?.s)} → ${dayOf(trial?.e)}`);
if (published) {
  ok('den autopublicerade sajten svarar 200', (await fetch(B + '/' + published.slug)).status === 200);
  await p.goto(B + '/admin/crecimiento', { waitUntil: 'domcontentloaded' });
  const row = p.locator('li', { hasText: `Peluqueria Smoke ${rnd}` });
  ok('syns under "Para revisar"', (await row.count()) === 1);
  await row.getByRole('button', { name: 'Revisado' }).click();
  await p.waitForTimeout(1500);
  ok('"Revisado" tar bort den ur listan', (await q('select needs_review nr from businesses where id = ?', [auto.row.id]))[0].nr === 0);
}

// Återställ: e2e-filen förutsätter manuell granskning och ingen promo.
await q("delete from settings where `key` in ('growth','promo')");
await db.end();
await finish(b, failed());
