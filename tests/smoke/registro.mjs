import { B, launchBrowser, createChecker, adminLogin, finish } from './_lib.mjs';

const { ok, failed } = createChecker();
const browser = await launchBrowser();
// Registro rate-limitar 5/h per IP i processen. En egen x-forwarded-for per
// körning (samma header som actions.ts läser) gör sviten körbar igen mot samma
// server utan omstart (R3-12); gränsen testas fortfarande inom körningen.
const runIp = `10.${Date.now() % 250}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': runIp } });
const page = await context.newPage();
const suffix = Date.now();
const name = `Registro smoke ${suffix}`;
const botName = `Registro bot ${suffix}`;
async function fill(businessName) {
  await page.goto(B + '/registro');
  await page.locator('[name=name]').fill(businessName);
  await page.locator('[name=category]').selectOption('taller');
  await page.locator('[name=phone]').fill('0981 123 456');
}
try {
  await fill(name);
  await page.getByRole('button', { name: 'Crear mi página', exact: true }).click();
  await page.waitForURL(url => /^\/alta\/[a-f0-9]{32}$/.test(url.pathname));
  // Read DOM text: CSS renders this label in uppercase (1. DATOS).
  ok('signup reaches intake datos', (await page.locator('.panel-steps > li[aria-current="step"]').textContent()).trim() === '1. Datos');
  ok('business name is shown', (await page.locator('h1').innerText()).includes(name));
  ok('business name is prefilled', await page.locator('[name=name]').inputValue() === name);

  await fill(botName);
  await page.locator('[name=website]').evaluate(input => { input.value = 'https://example.com'; });
  await page.getByRole('button', { name: 'Crear mi página', exact: true }).click();
  await page.getByRole('status').waitFor();
  ok('honeypot stays on registro with generic response', new URL(page.url()).pathname === '/registro');

  // rateLimit starts at 1 and rejects count > 5. Signup + honeypot are calls 1–2;
  // invalid forms consume calls 3–5 without creating drafts.
  for (let attempt = 3; attempt <= 5; attempt++) {
    await fill('x');
    await page.getByRole('button', { name: 'Crear mi página', exact: true }).click();
    await page.getByText('Escribí al menos 2 caracteres.', { exact: true }).waitFor();
  }
  const limitedName = `Registro limited ${suffix}`;
  await fill(limitedName);
  await page.getByRole('button', { name: 'Crear mi página', exact: true }).click();
  // Next.js also has a route-announcer alert; only inspect the form's error.
  const rateLimitMessage = 'Hiciste demasiados intentos. Probá de nuevo en una hora.';
  const formAlert = page.locator('form.panel-card > p[role="alert"]');
  await formAlert.filter({ hasText: rateLimitMessage }).waitFor();
  ok('sixth attempt is rate limited', (await formAlert.textContent()).trim() === rateLimitMessage && new URL(page.url()).pathname === '/registro');

  const admin = await browser.newPage();
  await adminLogin(admin, ok, browser);
  await admin.goto(B + '/admin/alta');
  const row = admin.locator('tbody tr').filter({ hasText: name });
  ok('draft appears with Auto-registro badge', await row.count() === 1 && await row.getByText('Auto-registro', { exact: true }).count() === 1);
  ok('signup is a draft', (await row.innerText()).includes('Borrador'));
  ok('honeypot creates no listed draft', await admin.locator('tbody tr').filter({ hasText: botName }).count() === 0);
  ok('rate limited attempt creates no listed draft', await admin.locator('tbody tr').filter({ hasText: limitedName }).count() === 0);
} catch {
  // Do not print Playwright errors: they can contain the private intake URL.
  ok('registro smoke completed without an exception', false);
}
await finish(browser, failed());
