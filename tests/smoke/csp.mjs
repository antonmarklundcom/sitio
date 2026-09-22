/**
 * Rök för Content-Security-Policy (R3-24): headern finns, och ingen av de
 * ytor vi har bryter mot den i en riktig webbläsare — landningen, en
 * kundsajt, förhandsvisningen, registret, owner-login och adminet. En
 * CSP-överträdelse syns bara i konsolen; här blir den ett rött kryss.
 *
 * Kör av tests/smoke/_run.mjs mot en byggd app (CSP:n sätts bara i produktion).
 */
import { B, adminLogin, createChecker, finish, launchBrowser } from './_lib.mjs';

const b = await launchBrowser();
const p = await b.newPage();
const { ok, failed } = createChecker();
await adminLogin(p, ok, b);

const head = await fetch(B + '/');
const csp = head.headers.get('content-security-policy') ?? '';
ok('CSP-headern finns', csp.includes("default-src 'self'") && csp.includes("object-src 'none'"), csp.slice(0, 60));
ok("frame-ancestors 'none'", csp.includes("frame-ancestors 'none'"));

// En publicerad kundsajt ur sitemapen — slugs byts av andra sviter.
const sitemap = await (await fetch(B + '/sitemap.xml')).text();
const sitePath = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => new URL(m[1]).pathname)
  .find((path) => path !== '/' && !path.startsWith('/registro'));

const violations = [];
p.on('console', (msg) => {
  if (/Content Security Policy/i.test(msg.text())) violations.push(`${p.url()}: ${msg.text().slice(0, 160)}`);
});
p.on('pageerror', (err) => {
  if (/Content Security Policy/i.test(String(err))) violations.push(`${p.url()}: ${String(err).slice(0, 160)}`);
});

const pages = ['/', '/registro', '/mi-sitio/login', '/admin', '/admin/sitios/1', '/admin/pagos', '/admin/leads'];
if (sitePath) pages.splice(1, 0, sitePath);
for (const path of pages) {
  await p.goto(B + path, { waitUntil: 'networkidle' });
  // Scrolla så att vy-eventens beacon och reveal-skripten faktiskt kör.
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(600);
}
ok('kundsajt hittad i sitemapen', Boolean(sitePath), sitePath ?? '');
ok('inga CSP-överträdelser på ' + pages.length + ' sidor', violations.length === 0, violations.join(' | '));

await finish(b, failed());
