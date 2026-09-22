/**
 * Rök för products-modulen (plan.md §6.1, PR-14).
 *
 * Egen fil (S1 äger inte scripts/smoke-e2e.mjs) och därför en egen inloggning
 * hela vägen: admin-session plus en owner-OTP-inloggning, precis som e2e-filens
 * steg 11 gör. Business 1:s owner-konto kan redan finnas (e2e-filen skapar det
 * om den körts först i samma svit) — testet skapar det bara om det saknas.
 *
 * Kör av tests/smoke/_run.mjs. Kräver en byggd app och en riktig MySQL —
 * skriver i databasen, kör aldrig mot produktion.
 */
import { B, adminLogin, createChecker, finish, launchBrowser } from './_lib.mjs';

const b = await launchBrowser();
const p = await b.newPage();
const { ok, failed } = createChecker();

await adminLogin(p, ok, b);

// ---------- 1. modulväxeln: hitta business 1:s rad, säkerställ på ----------
const modulesCardFor = (page) => page.locator('section').filter({ hasText: /módulos/i }).last();
const productsRowFor = (page) => modulesCardFor(page).locator('li').filter({ hasText: 'products' }).first();

await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
ok('products är byggd och märks inte som obyggd', !/todavía no está/i.test(await productsRowFor(p).innerText()));

if ((await productsRowFor(p).innerText()).includes('Activar')) {
  await productsRowFor(p).getByRole('button', { name: 'Activar' }).click();
  await p.waitForTimeout(2500);
}

// <SiteProducts> solo está conectado en el tema `comercio` esta fase (S6
// conecta los demás). Business 1 usa `servicios` en la semilla — sin este
// cambio, cualquier producto (visible u oculto) sería igualmente invisible
// en la página pública y el chequeo de abajo no probaría nada. Se restaura
// al final para no dejar el negocio de la semilla en otro rubro.
//
// Desde S7 (plan §1.11) el tema no se elige: lo decide el rubro. Por eso acá
// se cambia `category`, no `themeKey` — el selector de tema ya no existe.
await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const themeForm = p.locator('form').filter({ has: p.locator('select[name=category]') }).first();
const originalCategory = await themeForm.locator('select[name=category]').inputValue();
await themeForm.locator('select[name=category]').selectOption('comercio');
await themeForm.getByRole('button', { name: /Guardar/ }).first().click();
await p.waitForTimeout(2500);

// ---------- 2. owner-konto + OTP-inloggning (samma flöde som e2e-filens 11) ----------
await p.goto(B + '/admin/accesos', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
if (/sin cuenta de dueño/i.test(await p.locator('body').innerText())) {
  await p.getByRole('button', { name: 'Crear cuenta' }).first().click();
  await p.waitForTimeout(3000);
  await p.goto(B + '/admin/accesos', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
}
ok('owner-konto finns', (await p.locator('table tbody tr').count()) > 0);

const ownerPhone = (await p.locator('table tbody tr').first().locator('td').nth(1).innerText()).replace(/\s/g, '');
const owner = await b.newPage();
await owner.goto(B + '/mi-sitio/login', { waitUntil: 'domcontentloaded' });
await owner.fill('input[name=phone]', ownerPhone);
await owner.getByRole('button', { name: /Pedir código/ }).click();
await owner.waitForTimeout(2000);

await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Generar código' }).first().click();
await p.waitForTimeout(2500);
const ownerCode = ((await p.locator('body').innerText()).match(/\b\d{6}\b/) || [])[0];
ok('inloggningskod genererad', Boolean(ownerCode));

await owner.fill('input[name=code]', ownerCode ?? '');
await owner.getByRole('button', { name: 'Entrar' }).click();
await owner.waitForTimeout(3000);
ok('owner-inloggning ok', owner.url().endsWith('/mi-sitio'));

// ---------- 3. panelen dyker upp, produkter skapas ----------
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
await owner.waitForTimeout(1200);
const ownerBizId = ((await owner.locator('.panel-photos img').first().getAttribute('src').catch(() => null)) ?? '').split('/')[2] ?? null;
ok('productlistan dyker upp med modulen', (await owner.locator('body').innerText()).includes('Tus productos'));

const nombre1 = 'Silla artesanal ' + Date.now().toString().slice(-4);
await owner.getByRole('button', { name: 'Agregar producto' }).first().click();
await owner.waitForTimeout(600);
await owner.locator('.panel-menu-form input[name=name]').first().fill(nombre1);
await owner.locator('.panel-menu-form input[name=priceGs]').first().fill('450000');
await owner.getByRole('button', { name: 'Agregar producto' }).last().click();
await owner.waitForTimeout(3000);
const afterFirst = await owner.locator('body').innerText();
ok('producto con precio guardado', afterFirst.includes(nombre1) && afterFirst.includes('450.000'));

const nombre2 = 'Mesa a pedido ' + Date.now().toString().slice(-4);
await owner.getByRole('button', { name: 'Agregar producto' }).first().click();
await owner.waitForTimeout(600);
await owner.locator('.panel-menu-form input[name=name]').first().fill(nombre2);
await owner.locator('.panel-menu-form input[name=priceGs]').first().fill('');
await owner.getByRole('button', { name: 'Agregar producto' }).last().click();
await owner.waitForTimeout(3000);
ok('precio vacío se muestra como "A consultar"', (await owner.locator('body').innerText()).includes('A consultar'));

const ownerSlug = ((await owner.locator('.panel-top a').first().getAttribute('href').catch(() => null)) ?? '').split('/').pop();
if (ownerSlug) {
  const html = await (await fetch(B + '/' + ownerSlug)).text();
  ok('el catálogo se ve en la página pública (ISR)', html.includes(nombre1) && html.includes(nombre2));
  ok('el catálogo manda products_view (R3-17)', html.includes('data-ev-view="products_view"'));

  // El beacon de verdad: la vista sale una vez, cuando el catálogo se ve.
  // Playwright no expone el cuerpo de un sendBeacon, así que la página anota
  // cada envío en window.__ev antes de mandarlo.
  const visitor = await b.newPage();
  await visitor.addInitScript(() => {
    window.__ev = [];
    const original = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (data instanceof Blob) data.text().then((t) => window.__ev.push(t));
      return original(url, data);
    };
  });
  await visitor.goto(B + '/' + ownerSlug, { waitUntil: 'load' });
  await visitor.locator('#catalogo').scrollIntoViewIfNeeded();
  // `l` (R3-18) es el id de la sección para un evento de vista.
  const sent = await visitor
    .waitForFunction(
      () => window.__ev.some((t) => t.includes('"products_view"') && t.includes('"l":"catalogo"')),
      null,
      { timeout: 15000 },
    )
    .then(() => true)
    .catch(() => false);
  ok('el navegador manda products_view (con l=catalogo) al ver el catálogo', sent);
  await visitor.close();
}

// ---------- 3b. fotos de producto (R3-16) ----------
const sharp = (await import('sharp')).default;
const jpegOf = (r) =>
  sharp({ create: { width: 900, height: 700, channels: 3, background: { r, g: 90, b: 60 } } }).jpeg().toBuffer();
const productLi = (name) => owner.locator('.panel-menu-items li').filter({ hasText: name }).first();
const imgSrcOf = async (name) => {
  const img = productLi(name).locator('.panel-item-image img');
  return (await img.count()) ? img.first().getAttribute('src') : null;
};
const status = async (src) => (src ? (await fetch(B + src)).status : 0);

await owner.waitForLoadState('networkidle');
await productLi(nombre1).locator('.panel-item-image input[type=file]').setInputFiles({
  name: 'silla.jpg', mimeType: 'image/jpeg', buffer: await jpegOf(120),
});
await owner.waitForTimeout(3500);
const firstSrc = await imgSrcOf(nombre1);
ok('foto de producto subida desde el panel', Boolean(firstSrc) && (await status(firstSrc)) === 200, firstSrc ?? '');
if (ownerSlug) {
  const html = await (await fetch(B + '/' + ownerSlug)).text();
  ok('la foto sale en el catálogo público', html.includes('site-products-item-img') && html.includes(firstSrc ?? '§'));
}

await productLi(nombre1).locator('.panel-item-image input[type=file]').setInputFiles({
  name: 'silla2.jpg', mimeType: 'image/jpeg', buffer: await jpegOf(30),
});
await owner.waitForTimeout(3500);
const secondSrc = await imgSrcOf(nombre1);
ok('cambiar foto reemplaza la anterior', Boolean(secondSrc) && secondSrc !== firstSrc);
ok('la foto anterior se borra del disco', (await status(firstSrc)) === 404);

await productLi(nombre1).getByRole('button', { name: 'Quitar foto' }).click();
await owner.waitForTimeout(3000);
ok('quitar foto la saca del panel', (await imgSrcOf(nombre1)) === null);
ok('quitar foto borra el archivo', (await status(secondSrc)) === 404);

// Tenant-check en la ruta: un targetId que no es de esta cuenta no sube nada.
// fetch() desde la página: la cookie de sesión es Secure en producción y el
// APIRequestContext de Playwright no la manda por http.
const foreign = await owner.evaluate(async () => {
  const body = new FormData();
  body.set('kind', 'product');
  body.set('targetId', '99999999');
  body.set('file', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'x.jpg', { type: 'image/jpeg' }));
  return (await fetch('/api/upload', { method: 'POST', body })).status;
});
ok('producto ajeno o inexistente → 404', foreign === 404, String(foreign));

// La foto de nombre2 se queda para el paso 6: borrar el producto borra el archivo.
await productLi(nombre2).locator('.panel-item-image input[type=file]').setInputFiles({
  name: 'mesa.jpg', mimeType: 'image/jpeg', buffer: await jpegOf(80),
});
await owner.waitForTimeout(3500);
const mesaSrc = await imgSrcOf(nombre2);
ok('segunda foto subida', Boolean(mesaSrc));

// ---------- 4. ocultar: fuera del sitio, presente en el panel ----------
await owner
  .locator('.panel-menu-items li')
  .filter({ hasText: nombre1 })
  .first()
  .getByRole('button', { name: 'Ocultar' })
  .click();
await owner.waitForTimeout(3000);
ok('producto oculto sigue en el panel', (await owner.locator('body').innerText()).includes(nombre1));
if (ownerSlug) {
  const html = await (await fetch(B + '/' + ownerSlug)).text();
  ok('producto oculto no aparece en la página pública', !html.includes(nombre1));
}

// ---------- 5. módulo apagado: oculta sin borrar, rechaza el post de una pestaña vieja ----------
await owner.getByRole('button', { name: 'Agregar producto' }).first().click();
await owner.waitForTimeout(600);
await owner.locator('.panel-menu-form input[name=name]').first().fill('Producto fantasma');

await p.goto(B + '/admin/sitios/' + (ownerBizId ?? '1'), { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await productsRowFor(p).getByRole('button', { name: 'Desactivar' }).click();
await p.waitForTimeout(2500);
if (ownerSlug) {
  const html = await (await fetch(B + '/' + ownerSlug)).text();
  ok('módulo apagado oculta el catálogo entero', !html.includes(nombre2));
}

// La acción del servidor debe rechazar el post de la pestaña vieja: el
// control vive en productContext(), no en que el botón esté oculto.
await owner.getByRole('button', { name: 'Agregar producto' }).last().click();
await owner.waitForTimeout(3000);
ok(
  'módulo apagado rechaza el post de una pestaña vieja',
  (await owner.locator('body').innerText()).includes('No pudimos guardar'),
);

await p.goto(B + '/admin/sitios/' + (ownerBizId ?? '1'), { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await productsRowFor(p).getByRole('button', { name: 'Activar' }).click();
await p.waitForTimeout(2500);
if (ownerSlug) {
  const html = await (await fetch(B + '/' + ownerSlug)).text();
  ok('al reactivar, los datos vuelven (nada se borró)', html.includes(nombre2));
  ok('el post rechazado nunca se escribió', !html.includes('Producto fantasma'));
}

// ---------- 6. borrar productos: la foto se va con el producto (R3-16) ----------
// También es la limpieza: sin esto, cada corrida suma dos productos al tope de 60.
await owner.goto(B + '/mi-sitio', { waitUntil: 'domcontentloaded' });
await owner.waitForLoadState('networkidle');
for (const name of [nombre1, nombre2]) {
  await productLi(name).getByRole('button', { name: 'Borrar', exact: true }).click();
  await owner.waitForTimeout(2500);
}
const afterDelete = await owner.locator('body').innerText();
ok('productos de la corrida borrados', !afterDelete.includes(nombre1) && !afterDelete.includes(nombre2));
ok('borrar el producto borra su foto', (await status(mesaSrc)) === 404);

// Deja el rubro de la semilla como estaba — otros archivos de la suite (y una
// relectura humana de business 1) no deben ver un cambio permanente.
await p.goto(B + '/admin/sitios/1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await themeForm.locator('select[name=category]').selectOption(originalCategory);
await themeForm.getByRole('button', { name: /Guardar/ }).first().click();
await p.waitForTimeout(2000);

await finish(b, failed());
