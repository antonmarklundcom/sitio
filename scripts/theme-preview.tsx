/**
 * Renderar varje byggt tema × palettvariant till fristående HTML med påhittad
 * men realistisk kunddata, så att QA-gaten (web-design-system, qa-preflight.md)
 * kan köras utan databas och utan deploy. Bilderna är genererade platshållare
 * — inga riktiga foton, inga fabricerade omdömen.
 *
 * Kör: npm run theme:preview   ⇒ .preview/<tema>-v<variant>.html + index.html
 * Skärmdumpar: npm run theme:shots (kräver .preview/, se scripts/theme-shots.ts)
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ComercioTheme } from "../src/themes/comercio/comercio-theme";
import { GastronomiaTheme } from "../src/themes/gastronomia/gastronomia-theme";
import { ServiciosTheme } from "../src/themes/servicios/servicios-theme";
import { paletteFor, paletteToCssVars } from "../src/themes/palettes";
import type { ThemeProps } from "../src/themes/types";
import type { Business } from "../src/db/schema";

const OUT_DIR = ".preview";

/**
 * Platshållarbilder — färgade fält, inga påhittade "riktiga" foton. QA-gatens
 * regel om att aldrig fabricera bevis gäller även i en förhandsvisning.
 */
async function writePlaceholders(businessId: number, tones: { r: number; g: number; b: number }[]) {
  const dir = path.join(OUT_DIR, "media", String(businessId));
  await mkdir(dir, { recursive: true });

  const out: { file: string; variants: Record<string, string> }[] = [];
  for (const [i, tone] of tones.entries()) {
    const variants: Record<string, string> = {};
    for (const w of [400, 800, 1600]) {
      const name = `ph${businessId}-${i}-w${w}.webp`;
      const buf = await sharp({
        create: { width: w, height: Math.round((w * 3) / 4), channels: 3, background: tone },
      })
        .webp({ quality: 78 })
        .toBuffer();
      await writeFile(path.join(dir, name), buf);
      variants[`w${w}`] = name;
    }
    out.push({ file: `ph${businessId}-${i}`, variants });
  }
  return out;
}

const baseDemo = {
  id: 1,
  ownerUserId: null,
  rawDescription: null,
  whatsappVerifiedAt: new Date(),
  secondaryPhone: "+595212345678",
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
  paletteVariant: 1,
  logoMediaId: null,
  heroMediaId: null,
  status: "published",
  publishedAt: new Date(),
  aiPolishedAt: null,
  upsellScore: 0,
  hotLead: false,
  leadStage: "ninguno",
  adminNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

type Demo = {
  themeKey: string;
  cssFile: string;
  Theme: React.ComponentType<ThemeProps>;
  tones: { r: number; g: number; b: number }[];
  business: Business;
};

const demos: Demo[] = [
  {
    themeKey: "servicios",
    cssFile: "servicios/servicios.css",
    Theme: ServiciosTheme,
    tones: [
      { r: 58, g: 52, b: 44 },
      { r: 44, g: 48, b: 54 },
      { r: 66, g: 56, b: 40 },
      { r: 40, g: 44, b: 40 },
    ],
    business: {
      ...baseDemo,
      id: 1,
      slug: "electricidad-mendoza",
      name: "Electricidad Mendoza",
      category: "servicios",
      themeKey: "servicios",
      description:
        "Electricistas matriculados en Asunción y Gran Asunción. Instalaciones completas, " +
        "reparación de tableros, cableado de casas y comercios, y atención de urgencias el mismo día.",
      servicesJson: [
        { name: "Urgencias eléctricas 24 h", desc: "Cortes, cortocircuitos y fallas atendidas el mismo día, sin recargo por diagnóstico." },
        { name: "Instalaciones completas", desc: "Casas, departamentos y locales comerciales, con certificado." },
        { name: "Reparación de tableros", desc: "Diagnóstico y cambio de térmicas y disyuntores." },
        { name: "Puesta a tierra", desc: "Medición y certificación según norma." },
      ],
      whatsappPhone: "+595981432110",
      address: "Av. Eusebio Ayala 1230",
      zone: "Villa Aurelia",
      city: "Asunción",
      seoTitle: "Electricistas matriculados en Villa Aurelia",
      seoDescription: "Electricistas matriculados en Asunción. Instalaciones, tableros y urgencias.",
    } as unknown as Business,
  },
  {
    themeKey: "gastronomia",
    cssFile: "gastronomia/gastronomia.css",
    Theme: GastronomiaTheme,
    tones: [
      { r: 122, g: 84, b: 58 },
      { r: 96, g: 74, b: 50 },
      { r: 140, g: 106, b: 72 },
      { r: 84, g: 68, b: 52 },
      { r: 112, g: 92, b: 64 },
      { r: 132, g: 96, b: 66 },
    ],
    business: {
      ...baseDemo,
      id: 2,
      slug: "cocina-de-ña-rosa",
      name: "Cocina de Ña Rosa",
      category: "gastronomia",
      themeKey: "gastronomia",
      description:
        "Comida paraguaya de olla, hecha cada mañana. Guiso, milanesa, sopa paraguaya y chipa guasú " +
        "para llevar o comer en el local. Menú del día de lunes a sábado, y pedidos por WhatsApp " +
        "hasta media hora antes de cerrar.",
      servicesJson: [
        { name: "Menú del día", desc: "Plato principal, guarnición y postre. Cambia todos los días y se anuncia por WhatsApp." },
        { name: "Sopa paraguaya y chipa guasú", desc: "Hechas en el horno del local, por porción o por bandeja." },
        { name: "Asado del sábado", desc: "Costilla, vacío y mandioca. Se encarga hasta el viernes." },
        { name: "Viandas semanales", desc: "Cinco almuerzos, retirás el lunes o te los llevamos." },
        { name: "Tortas por encargo", desc: "Para cumpleaños y oficinas, con 48 horas de aviso." },
      ],
      whatsappPhone: "+595971220145",
      address: "Cerro Corá 845",
      zone: "Barrio Jara",
      city: "Asunción",
      hoursJson: {
        mon: [{ open: "11:00", close: "15:00" }],
        tue: [{ open: "11:00", close: "15:00" }],
        wed: [{ open: "11:00", close: "15:00" }],
        thu: [{ open: "11:00", close: "15:00" }],
        fri: [{ open: "11:00", close: "15:00" }, { open: "19:00", close: "23:00" }],
        sat: [{ open: "11:00", close: "16:00" }],
        sun: null,
      },
      seoTitle: "Cocina de Ña Rosa",
      seoDescription: "Comida paraguaya de olla en Barrio Jara. Menú del día y pedidos por WhatsApp.",
    } as unknown as Business,
  },
  {
    themeKey: "comercio",
    cssFile: "comercio/comercio.css",
    Theme: ComercioTheme,
    tones: [
      { r: 96, g: 104, b: 120 },
      { r: 118, g: 122, b: 130 },
      { r: 84, g: 96, b: 108 },
      { r: 128, g: 128, b: 124 },
      { r: 104, g: 112, b: 126 },
      { r: 92, g: 100, b: 112 },
    ],
    business: {
      ...baseDemo,
      id: 3,
      slug: "ferreteria-san-blas",
      name: "Ferretería San Blas",
      category: "comercio",
      themeKey: "comercio",
      description:
        "Ferretería de barrio con herramientas, sanitarios, pinturas y electricidad. Atendemos " +
        "por WhatsApp: si no lo tenemos, lo conseguimos para el día siguiente. Entregas en la zona " +
        "sin cargo a partir de 200.000 Gs.",
      servicesJson: [
        { name: "Herramientas y accesorios", desc: "Manuales y eléctricas, con garantía del importador." },
        { name: "Sanitarios y grifería", desc: "Repuestos sueltos, no solo el kit completo." },
        { name: "Pinturas y accesorios", desc: "Preparamos el color en el local mientras esperás." },
        { name: "Materiales eléctricos", desc: "Cables por metro, térmicas, cajas y llaves." },
        { name: "Entregas en la zona", desc: "Sin cargo desde 200.000 Gs, el mismo día si pedís antes de las 15:00." },
      ],
      whatsappPhone: "+595983774210",
      address: "Ruta Mcal. Estigarribia 3120",
      zone: "San Lorenzo Centro",
      city: "San Lorenzo",
      hoursJson: {
        mon: [{ open: "07:30", close: "18:00" }],
        tue: [{ open: "07:30", close: "18:00" }],
        wed: [{ open: "07:30", close: "18:00" }],
        thu: [{ open: "07:30", close: "18:00" }],
        fri: [{ open: "07:30", close: "18:00" }],
        sat: [{ open: "07:30", close: "13:00" }],
        sun: null,
      },
      seoTitle: "Ferretería San Blas",
      seoDescription: "Ferretería en San Lorenzo: herramientas, sanitarios, pinturas y entregas en la zona.",
    } as unknown as Business,
  },
];

function motionScript(): string {
  // Samma script som produktionen, läst ur källan så förhandsvisningen aldrig
  // hamnar ur synk med den riktiga rörelsen.
  const src = readFileSync(path.resolve("src/components/site/site-scripts.tsx"), "utf8");
  const match = /const MOTION = `([\s\S]*?)`;/.exec(src);
  return match ? match[1] : "";
}

function css(themeCssFile: string): string {
  const root = path.resolve("src/themes");
  return [
    readFileSync(path.join(root, "theme.css"), "utf8"),
    readFileSync(path.join(root, themeCssFile), "utf8"),
  ].join("\n");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const written: string[] = [];

  for (const demo of demos) {
    const placeholders = await writePlaceholders(demo.business.id, demo.tones);
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
      const palette = paletteFor(demo.themeKey, variant);
      const vars = Object.entries(paletteToCssVars(palette))
        .map(([k, v]) => `${k}:${v}`)
        .join(";");

      const Theme = demo.Theme;
      const body = renderToStaticMarkup(
        <Theme
          business={{ ...demo.business, paletteVariant: variant }}
          photos={photos}
          logo={null}
          hero={photos[0]}
          modules={new Set<string>()}
        />,
      );

      const html = `<!doctype html>
<html lang="es-PY">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>QA — ${demo.themeKey} v${variant}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600&family=Inter+Tight:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box}
body{margin:0}
:root{--font-display:'Bricolage Grotesque',system-ui,sans-serif;--font-text:'Inter Tight',system-ui,sans-serif}
${css(demo.cssFile)}
</style>
</head>
<body><div style="${vars}">${body}</div>
<script>document.documentElement.classList.add('js')</script>
<script>${motionScript()}</script>
</body>
</html>`;

      const file = path.join(OUT_DIR, `${demo.themeKey}-v${variant}.html`);
      await writeFile(file, html, "utf8");
      written.push(`${demo.themeKey}-v${variant}.html`);
      console.log(`✓ ${file}  (accent ${palette.accent}, hue ${palette.hue}°)`);
    }
  }

  const index = `<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><title>QA-index</title>
<style>body{font:16px/1.6 system-ui;margin:2rem;max-width:40rem}a{display:block;padding:.35rem 0}</style>
</head><body><h1>Temaförhandsvisningar</h1>
${written.map((f) => `<a href="${f}">${f}</a>`).join("\n")}
</body></html>`;
  await writeFile(path.join(OUT_DIR, "index.html"), index, "utf8");
  console.log(`✓ ${path.join(OUT_DIR, "index.html")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
