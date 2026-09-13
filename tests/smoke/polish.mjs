/**
 * Rök för AI-putsen (plan.md §5.3).
 *
 * Det testet kan köra utan att betala för ett API-anrop är degraderingen:
 * utan ANTHROPIC_API_KEY ska panelen rendera, säga varför den är låst och ha
 * knappen avstängd — inte krascha sidan och inte försvinna. Det är också det
 * enda tillstånd en CI-miljö garanterat har.
 *
 * Körs av tests/smoke/_run.mjs. Nyckeln läses ur det här skalets miljö, samma
 * skal som startade servern; är den satt kontrolleras det motsatta läget.
 */
import { B, adminLogin, createChecker, finish, launchBrowser } from './_lib.mjs';

const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY);

const b = await launchBrowser();
const p = await b.newPage();
const { ok, failed } = createChecker();

await adminLogin(p, ok, b);

// Seedens sajt. Namn och slug byts av e2e-svitens CRUD-steg, id:t gör det inte.
await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });

const panel = p.locator('[data-testid=polish-panel]');
ok('putspanelen renderas', await panel.isVisible({ timeout: 15000 }).catch(() => false));

// innerText ger den RENDERADE texten, och SectionTitle är versaliserad i css:
// rubriker matchas därför skiftlägesokänsligt.
const body = await p.locator('body').innerText();
const has = (needle) => body.toLowerCase().includes(needle.toLowerCase());

ok('rubriken Pulir textos finns', has('Pulir textos'));
ok('modellen står utskriven', /claude-[a-z0-9-]+/.test(body));

// Knappen heter "Pulir textos" första gången och "Kör igen" när ett förslag
// redan ligger i activity_log — båda är samma knapp.
const button = panel.getByRole('button', { name: /Pulir textos|Kör igen/ }).first();
ok('putsknappen finns', await button.isVisible().catch(() => false));

const disabled = await button.isDisabled().catch(() => null);
const warns = body.includes('ANTHROPIC_API_KEY saknas i miljön');

if (HAS_KEY) {
  ok('med nyckel: ingen saknas-varning', !warns);
  ok('med nyckel: knappen går att trycka på', disabled === false);
} else {
  ok('utan nyckel: panelen säger vilken variabel som saknas', warns);
  ok('utan nyckel: knappen är avstängd', disabled === true);
  ok('utan nyckel: sidan renderar ändå resten', has('Status och länkar') && has('Bilder') && has('Moduler'));
}

// Degraderingen får inte hänga på att sidan är trasig: en 500 hade gett en
// tom body långt innan kontrollerna ovan.
ok('sidan är inte en felsida', !has('Application error') && !body.includes('500'));

await finish(b, failed());
