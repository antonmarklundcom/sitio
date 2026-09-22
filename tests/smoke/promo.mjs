// Writes through the UI. Run only against a migrated, seeded development database.
// Database access below is read-only; never print private intake URLs or DB errors.
import { config } from 'dotenv';
import mysql from 'mysql2/promise';
import { B, launchBrowser, createChecker, adminLogin, finish } from './_lib.mjs';
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });
const { ok, failed } = createChecker();
const browser = await launchBrowser();
const admin = await browser.newPage();
// Separate the promo suite from registro.mjs's deliberate rate-limit exhaustion.
// Egen IP per körning (R3-12): registro räknar 5/h per IP i processen.
const customer = await browser.newPage({ extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${(Date.now() % 200) + 20}` } });
const banner = 'Probá Plus gratis 14 días — promoción smoke';
const suffix = Date.now();
let db;
let original;
async function save(values) {
  await admin.goto(B + '/admin/promociones');
  await admin.locator('[name=trialEnabled]').setChecked(values.trialEnabled);
  await admin.locator('[name=trialDays]').fill(String(values.trialDays));
  await admin.locator('[name=trialPlan]').selectOption(values.trialPlan);
  await admin.locator('[name=bannerText]').fill(values.bannerText);
  await admin.getByRole('button', { name: 'Guardar', exact: true }).click();
  await admin.getByRole('status').filter({ hasText: 'Promoción guardada.' }).waitFor();
}
async function signup(name) {
  await customer.goto(B + '/registro');
  await customer.locator('[name=name]').fill(name);
  await customer.locator('[name=category]').selectOption('taller');
  await customer.locator('[name=phone]').fill('0981 123 456');
  await customer.getByRole('button', { name: 'Crear mi página', exact: true }).click();
  await customer.waitForURL(url => /^\/alta\/[a-f0-9]{32}$/.test(url.pathname));
}
try {
  if (!process.env.DATABASE_URL) throw new Error('Missing database configuration');
  db = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: 'Z' });
  await adminLogin(admin, ok, browser);
  await admin.goto(B + '/admin/promociones');
  original = {
    trialEnabled: await admin.locator('[name=trialEnabled]').isChecked(),
    trialDays: Number(await admin.locator('[name=trialDays]').inputValue()),
    trialPlan: await admin.locator('[name=trialPlan]').inputValue(),
    bannerText: await admin.locator('[name=bannerText]').inputValue(),
  };
  const enabled = { trialEnabled: true, trialDays: 14, trialPlan: 'plus', bannerText: banner };
  await save(enabled);
  const [settings] = await db.execute('SELECT value FROM settings WHERE `key` = ?', ['promo']);
  const stored = JSON.parse(settings[0].value);
  ok('settings persist as promo JSON', Object.entries(enabled).every(([key, value]) => stored[key] === value));
  await customer.goto(B + '/');
  ok('landing shows promotion and registration link', await customer.getByTestId('promo-banner').innerText().then(text => text.includes(banner)) && await customer.getByTestId('promo-banner').locator('a').getAttribute('href') === '/registro');
  await customer.goto(B + '/registro');
  ok('registration shows offer', await customer.getByTestId('promo-offer').innerText() === 'Probá Plus gratis 14 días');
  const name = 'Promo smoke ' + suffix;
  await signup(name);
  const [rows] = await db.execute('SELECT s.status, s.plan, s.price_gs, DATEDIFF(s.expires_at, s.starts_at) AS days, s.starts_at = UTC_DATE() AS starts_today FROM subscriptions s JOIN businesses b ON b.id = s.business_id WHERE b.name = ?', [name]);
  ok('signup creates exactly one Plus trial at suggested price for 14 days starting today', rows.length === 1 && rows[0].status === 'trial' && rows[0].plan === 'plus' && Number(rows[0].price_gs) === 600000 && Number(rows[0].days) === 14 && Number(rows[0].starts_today) === 1);
  const [logs] = await db.execute('SELECT a.id FROM activity_log a JOIN businesses b ON b.id = a.business_id WHERE b.name = ? AND a.action = ?', [name, 'trial_iniciado']);
  ok('trial start is logged', logs.length === 1);
  await save({ ...enabled, trialEnabled: false });
  await customer.goto(B + '/');
  ok('disabled promotion removes banner', await customer.getByTestId('promo-banner').count() === 0);
  await customer.goto(B + '/registro');
  ok('disabled promotion removes offer', await customer.getByTestId('promo-offer').count() === 0);
  const offName = 'Promo off smoke ' + suffix;
  await signup(offName);
  const [off] = await db.execute('SELECT s.id FROM subscriptions s JOIN businesses b ON b.id = s.business_id WHERE b.name = ?', [offName]);
  ok('disabled promotion creates no subscription', off.length === 0);
} catch {
  ok('promo smoke completed without an exception', false);
} finally {
  if (original) {
    try { await save(original); } catch { ok('original promotion restored', false); }
  }
  if (db) await db.end();
}
await finish(browser, failed());
