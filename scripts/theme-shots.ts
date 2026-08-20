/**
 * QA-skärmdumpar av temaförhandsvisningarna i 360 / 768 / 1280 px — de tre
 * bredder qa-preflight.md kräver. Kör `npm run theme:preview` först.
 *
 * Kör: npm run theme:shots [tema ...]   ⇒ .preview/shots/<tema>-v<n>-<bredd>.png
 *
 * Chromium tas från PLAYWRIGHT_CHROMIUM_PATH (eller /opt/pw-browsers/chromium)
 * när den finns, annars från Playwrights egen installation.
 */
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const PREVIEW_DIR = ".preview";
const SHOT_DIR = path.join(PREVIEW_DIR, "shots");
const WIDTHS = [360, 768, 1280];

async function main() {
  const filter = process.argv.slice(2);
  const files = (await readdir(PREVIEW_DIR))
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .filter((f) => filter.length === 0 || filter.some((t) => f.startsWith(`${t}-`)))
    .sort();

  if (files.length === 0) {
    throw new Error("Inga förhandsvisningar hittades. Kör `npm run theme:preview` först.");
  }

  await mkdir(SHOT_DIR, { recursive: true });

  // Sidorna serveras över HTTP, inte file:// — bildernas src är rotrelativa
  // (/media/<bizId>/…) och blir annars 404, vilket ger skärmdumpar med
  // trasiga bilder och en QA-runda som ser fel ut av fel anledning.
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");
    const file = path.resolve(PREVIEW_DIR, rel);
    if (!file.startsWith(path.resolve(PREVIEW_DIR))) {
      res.writeHead(403).end();
      return;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
    } catch {
      res.writeHead(404).end();
      return;
    }
    const type = file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".webp") ? "image/webp" : "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const origin = `http://127.0.0.1:${port}`;
  // Playwrights egen nedladdning finns inte i alla miljöer; när en färdig
  // Chromium är monterad används den i stället för att ladda ner 150 MB.
  const bundled = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(
    existsSync(bundled) ? { executablePath: bundled } : {},
  );

  try {
    for (const file of files) {
      const url = `${origin}/${file}`;
      for (const width of WIDTHS) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        await page.goto(url, { waitUntil: "load" });
        // Reveal-animationen körs på scroll; rulla igenom sidan och vänta tills
        // varje .reveal faktiskt har fått .is-in. Utan väntan hamnar sektioner
        // på bild med opacity 0 och läses som tomma — det är en artefakt av
        // skärmdumpen, inte en bugg i temat, och döljer riktiga fel.
        const revealed = await page.evaluate(async () => {
          const step = Math.round(window.innerHeight * 0.6);
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 200));
          }
          window.scrollTo(0, 0);
          const all = Array.from(document.querySelectorAll(".reveal"));
          for (let i = 0; i < 20; i++) {
            if (all.every((el) => el.classList.contains("is-in"))) break;
            await new Promise((r) => setTimeout(r, 150));
          }
          await new Promise((r) => setTimeout(r, 300));
          return all.filter((el) => !el.classList.contains("is-in")).length;
        });
        if (revealed > 0) console.error(`  ! ${revealed} .reveal-element utan is-in (${file} @ ${width})`);

        const out = path.join(SHOT_DIR, `${file.replace(/\.html$/, "")}-${width}.png`);
        await page.screenshot({ path: out, fullPage: true });
        console.log(`✓ ${out}`);

        // Horisontell scroll är ett hårt fel i QA-gaten — mät den här i
        // stället för att hoppas att den syns på en fullpage-bild.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (overflow > 0) console.error(`  ✗ horisontell scroll: ${overflow}px (${file} @ ${width})`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
