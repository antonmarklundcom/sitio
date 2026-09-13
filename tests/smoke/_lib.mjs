/**
 * Delade hjälpare för rökkörningarna.
 *
 * Ligger separat sedan O1 (plan.md §5.1): scripts/smoke-e2e.mjs var en enda
 * 540-radersfil, och två parallella faser kan inte båda lägga till i den. Varje
 * fas äger i stället sin egen tests/smoke/<fas>.mjs och importerar härifrån.
 *
 * Allt här skriver i databasen. Kör aldrig mot produktion.
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

export const B = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3100';
export const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'anton@sitio.com.py';
export const PASS = process.env.SEED_ADMIN_PASSWORD ?? 'sitio-dev-1234';

/** Chromium från containerns förinstallerade bunt när den finns. */
export async function launchBrowser() {
  const bundled = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
  return chromium.launch(existsSync(bundled) ? { executablePath: bundled } : {});
}

/**
 * Räknaren. Returnerar `ok` att anropa per kontroll och `failed()` för
 * slutstatusen — en modulnivåvariabel går inte att dela mellan filer.
 */
export function createChecker() {
  let failed = 0;
  const ok = (n, cond, extra = '') => {
    if (!cond) failed++;
    console.log(`${cond ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`);
  };
  return { ok, failed: () => failed };
}

/**
 * Loggar in i superadmin. Avbryter processen om inloggningen inte går igenom —
 * varje efterföljande kontroll hade annars fallit av samma orsak och dolt den.
 */
export async function adminLogin(page, ok, browser) {
  await page.goto(B + '/admin/login');
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASS);
  await page.click('button[type=submit]');
  await page
    .waitForURL((u) => !u.pathname.startsWith('/admin/login'), { timeout: 30000 })
    .catch(() => {});
  ok('login', !page.url().includes('/admin/login'), page.url());

  if (page.url().includes('/admin/login')) {
    const why = await page.locator('body').innerText();
    // Inloggningens rate limit är per process och gäller 15 minuter. Två
    // smoke-körningar tätt inpå varandra slår i den — starta om servern.
    if (why.includes('För många försök')) {
      console.error('avbryter: inloggningens rate limit slog till. Starta om servern och kör igen.');
    } else {
      console.error('avbryter: inloggningen gick inte igenom —', why);
    }
    await browser.close();
    process.exit(1);
  }
  return page;
}

/** Standardavslut: stäng browsern och sätt exitkoden efter utfallet. */
export async function finish(browser, failed) {
  await browser.close();
  console.log(failed === 0 ? '\nAllt grönt.' : `\n${failed} kontroll(er) föll.`);
  process.exit(failed === 0 ? 0 : 1);
}
