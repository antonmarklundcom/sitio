/**
 * Renderar ett tema till fristående HTML med påhittad men realistisk kunddata,
 * så att QA-gaten (web-design-system, qa-preflight.md) kan köras utan databas
 * och utan deploy. Bilderna är genererade platshållare — inga riktiga foton.
 *
 * Kör: npm run theme:preview   ⇒ .preview/<tema>-<variant>.html
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ServiciosTheme } from "../src/themes/servicios/servicios-theme";
import { paletteFor, paletteToCssVars } from "../src/themes/palettes";
import type { Business } from "../src/db/schema";

const OUT_DIR = ".preview";

/**
 * Platshållarbilder — färgade fält, inga påhittade "riktiga" foton. QA-gatens
 * regel om att aldrig fabricera bevis gäller även i en förhandsvisning.
 */
async function writePlaceholders(businessId: number) {
  const dir = path.join(OUT_DIR, "media", String(businessId));
  await mkdir(dir, { recursive: true });

  const tones = [
    { r: 58, g: 52, b: 44 },
    { r: 44, g: 48, b: 54 },
    { r: 66, g: 56, b: 40 },
    { r: 40, g: 44, b: 40 },
  ];

  const out: { file: string; variants: Record<string, string> }[] = [];
  for (const [i, tone] of tones.entries()) {
    const variants: Record<string, string> = {};
    for (const w of [400, 800, 1600]) {
      const name = `ph${i}-w${w}.webp`;
      const buf = await sharp({
        create: { width: w, height: Math.round((w * 3) / 4), channels: 3, background: tone },
      })
        .webp({ quality: 78 })
        .toBuffer();
      await writeFile(path.join(dir, name), buf);
      variants[`w${w}`] = name;
    }
    out.push({ file: `ph${i}`, variants });
  }
  return out;
}

const demo = {
  id: 1,
  ownerUserId: null,
  slug: "electricidad-mendoza",
  name: "Electricidad Mendoza",
  category: "servicios",
  description:
    "Electricistas matriculados en Asunción y Gran Asunción. Instalaciones completas, " +
    "reparación de tableros, cableado de casas y comercios, y atención de urgencias el mismo día.",
  rawDescription: null,
  servicesJson: [
    { name: "Urgencias eléctricas 24 h", desc: "Cortes, cortocircuitos y fallas atendidas el mismo día, sin recargo por diagnóstico." },
    { name: "Instalaciones completas", desc: "Casas, departamentos y locales comerciales, con certificado." },
    { name: "Reparación de tableros", desc: "Diagnóstico y cambio de térmicas y disyuntores." },
    { name: "Puesta a tierra", desc: "Medición y certificación según norma." },
  ],
  whatsappPhone: "+595981432110",
  whatsappVerifiedAt: new Date(),
  secondaryPhone: "+595212345678",
  address: "Av. Eusebio Ayala 1230",
  zone: "Villa Aurelia",
  city: "Asunción",
  lat: "-25.3167",
  lng: "-57.6333",
  mapsUrl: "https://maps.app.goo.gl/demo",
  socialsJson: { facebook: "https://facebook.com/demo", instagram: "https://instagram.com/demo" },
  hoursJson: {
    mon: [{ open: "08:00", close: "17:00" }],
    tue: [{ open: "08:00", close: "17:00" }],
    wed: [{ open: "08:00", close: "17:00" }],
    thu: [{ open: "08:00", close: "17:00" }],
    fri: [{ open: "08:00", close: "17:00" }],
    sat: [{ open: "08:00", close: "12:00" }],
    sun: null,
  },
  ruc: "80012345-6",
  themeKey: "servicios",
  paletteVariant: 1,
  logoMediaId: null,
  heroMediaId: null,
  status: "published",
  publishedAt: new Date(),
  seoTitle: "Electricistas matriculados en Villa Aurelia",
  seoDescription: "Electricistas matriculados en Asunción. Instalaciones, tableros y urgencias.",
  aiPolishedAt: null,
  upsellScore: 0,
  hotLead: false,
  leadStage: "ninguno",
  adminNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Business;

function motionScript(): string {
  // Samma script som produktionen, läst ur källan så förhandsvisningen aldrig
  // hamnar ur synk med den riktiga rörelsen.
  const src = readFileSync(path.resolve("src/components/site/site-scripts.tsx"), "utf8");
  const match = /const MOTION = `([\s\S]*?)`;/.exec(src);
  return match ? match[1] : "";
}

function css(): string {
  const root = path.resolve("src/themes");
  return [
    readFileSync(path.join(root, "theme.css"), "utf8"),
    readFileSync(path.join(root, "servicios/servicios.css"), "utf8"),
  ].join("\n");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const placeholders = await writePlaceholders(1);
  const photos = placeholders.map((ph, i) => ({
    id: i + 1,
    kind: "photo" as const,
    variantsJson: ph.variants as { w400?: string; w800?: string; w1600?: string },
    altText: "Imagen de ejemplo (placeholder)",
    width: 1600,
    height: 1200,
    sortOrder: i,
  }));

  for (const variant of [1, 2, 3, 4]) {
    const palette = paletteFor("servicios", variant);
    const vars = Object.entries(paletteToCssVars(palette))
      .map(([k, v]) => `${k}:${v}`)
      .join(";");

    const body = renderToStaticMarkup(
      <ServiciosTheme
        business={{ ...demo, paletteVariant: variant }}
        photos={photos}
        logo={null}
        hero={photos[0]}
        modules={new Set()}
      />,
    );

    const html = `<!doctype html>
<html lang="es-PY">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>QA — servicios v${variant}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600&family=Inter+Tight:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box}
body{margin:0}
:root{--font-display:'Bricolage Grotesque',system-ui,sans-serif;--font-text:'Inter Tight',system-ui,sans-serif}
${css()}
</style>
</head>
<body><div style="${vars}">${body}</div>
<script>document.documentElement.classList.add('js')</script>
<script>${motionScript()}</script>
</body>
</html>`;

    const file = path.join(OUT_DIR, `servicios-v${variant}.html`);
    await writeFile(file, html, "utf8");
    console.log(`✓ ${file}  (accent ${palette.accent}, hue ${palette.hue}°)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
