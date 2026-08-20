/**
 * Utvecklingsseed: en superadmin + tre demo-företag med realistisk PY-data.
 * Kör: npm run db:seed   (tsx laddar inte .env själv — src/lib/env.ts gör det)
 *
 * Idempotent: kör om utan att duplicera (slug/e-post är unika nycklar).
 */
import "../src/lib/env";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../src/lib/env";
import * as schema from "../src/db/schema";
import { businesses, businessModules, subscriptions, users } from "../src/db/schema";

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "anton@sitio.com.py";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "sitio-dev-1234";

type HoursMap = Record<string, { open: string; close: string }[] | null>;

const weekdays9to18: HoursMap = {
  mon: [{ open: "08:00", close: "17:00" }],
  tue: [{ open: "08:00", close: "17:00" }],
  wed: [{ open: "08:00", close: "17:00" }],
  thu: [{ open: "08:00", close: "17:00" }],
  fri: [{ open: "08:00", close: "17:00" }],
  sat: [{ open: "08:00", close: "12:00" }],
  sun: null,
};

const gastroHours: HoursMap = {
  mon: null,
  tue: [{ open: "11:30", close: "14:30" }, { open: "19:00", close: "23:00" }],
  wed: [{ open: "11:30", close: "14:30" }, { open: "19:00", close: "23:00" }],
  thu: [{ open: "11:30", close: "14:30" }, { open: "19:00", close: "23:00" }],
  fri: [{ open: "11:30", close: "14:30" }, { open: "19:00", close: "00:00" }],
  sat: [{ open: "11:30", close: "00:00" }],
  sun: [{ open: "11:30", close: "15:00" }],
};

const comercioHours: HoursMap = {
  mon: [{ open: "08:00", close: "18:00" }],
  tue: [{ open: "08:00", close: "18:00" }],
  wed: [{ open: "08:00", close: "18:00" }],
  thu: [{ open: "08:00", close: "18:00" }],
  fri: [{ open: "08:00", close: "18:00" }],
  sat: [{ open: "08:00", close: "13:00" }],
  sun: null,
};

const demoBusinesses = [
  {
    slug: "electricidad-mendoza",
    name: "Electricidad Mendoza",
    category: "servicios" as const,
    themeKey: "servicios" as const,
    paletteVariant: 1,
    rawDescription:
      "Somos electricistas matriculados en Asunción. Trabajamos en instalaciones nuevas, " +
      "reparación de tableros, cableado de casas y comercios. Atendemos urgencias.",
    description:
      "Electricistas matriculados en Asunción y Gran Asunción. Instalaciones completas, " +
      "reparación de tableros, cableado de casas y comercios, y atención de urgencias el mismo día.",
    servicesJson: [
      { name: "Instalaciones eléctricas", desc: "Casas, departamentos y locales comerciales." },
      { name: "Reparación de tableros", desc: "Diagnóstico y cambio de térmicas y disyuntores." },
      { name: "Urgencias 24 h", desc: "Cortes, cortocircuitos y fallas en el día." },
      { name: "Puesta a tierra", desc: "Medición y certificación según norma." },
    ],
    whatsappPhone: "+595981432110",
    secondaryPhone: "+595212345678",
    address: "Av. Eusebio Ayala 1230",
    zone: "Villa Aurelia",
    city: "Asunción",
    hoursJson: weekdays9to18,
    socialsJson: { facebook: "https://facebook.com/electricidadmendoza" },
    seoTitle: "Electricidad Mendoza – Electricista en Villa Aurelia, Asunción",
    seoDescription:
      "Electricistas matriculados en Asunción. Instalaciones, tableros y urgencias. Presupuesto por WhatsApp.",
    status: "published" as const,
    plan: "basico" as const,
    priceGs: 300_000,
  },
  {
    slug: "pizzeria-la-nona",
    name: "Pizzería La Nona",
    category: "gastronomia" as const,
    themeKey: "gastronomia" as const,
    paletteVariant: 2,
    rawDescription:
      "Pizzería familiar en San Lorenzo, masa madre y horno a leña. Delivery por la zona.",
    description:
      "Pizzería familiar en San Lorenzo. Masa madre fermentada 48 horas y horno a leña. " +
      "Retiro en el local o delivery en la zona céntrica.",
    servicesJson: [
      { name: "Pizzas a la piedra", desc: "Masa madre, horno a leña." },
      { name: "Empanadas caseras", desc: "Carne, pollo, jamón y queso." },
      { name: "Delivery", desc: "Zona céntrica de San Lorenzo." },
    ],
    whatsappPhone: "+595985776432",
    secondaryPhone: null,
    address: "Ruta Mcal. Estigarribia c/ Cnel. Romero",
    zone: "Centro",
    city: "San Lorenzo",
    hoursJson: gastroHours,
    socialsJson: {
      instagram: "https://instagram.com/pizzerialanona",
      facebook: "https://facebook.com/pizzerialanona",
    },
    seoTitle: "Pizzería La Nona – Pizza a la leña en San Lorenzo",
    seoDescription:
      "Pizzería familiar en San Lorenzo: masa madre, horno a leña y delivery. Pedidos por WhatsApp.",
    status: "published" as const,
    plan: "plus" as const,
    priceGs: 450_000,
  },
  {
    slug: "ferreteria-san-blas",
    name: "Ferretería San Blas",
    category: "comercio" as const,
    themeKey: "comercio" as const,
    paletteVariant: 3,
    rawDescription:
      "Ferretería de barrio en Luque. Herramientas, pinturas, electricidad y sanitarios. " +
      "Atendemos a albañiles y a vecinos.",
    description:
      "Ferretería de barrio en Luque con stock permanente de herramientas, pinturas, " +
      "materiales eléctricos y sanitarios. Atención a profesionales y vecinos.",
    servicesJson: [
      { name: "Herramientas", desc: "Manuales y eléctricas, marcas conocidas." },
      { name: "Pinturas y accesorios", desc: "Preparación de color en el local." },
      { name: "Electricidad y sanitarios", desc: "Todo para la obra chica." },
    ],
    whatsappPhone: "+595971204588",
    secondaryPhone: "+595216820011",
    address: "Av. Gral. Aquino 845",
    zone: "San Blas",
    city: "Luque",
    hoursJson: comercioHours,
    socialsJson: {},
    seoTitle: "Ferretería San Blas – Ferretería en Luque",
    seoDescription:
      "Ferretería en Luque: herramientas, pinturas, electricidad y sanitarios. Consultas por WhatsApp.",
    status: "pending_review" as const,
    plan: "basico" as const,
    priceGs: 250_000,
  },
];

async function main() {
  const pool = mysql.createPool({ uri: env.databaseUrl, connectionLimit: 4, timezone: "Z" });
  const db = drizzle(pool, { schema, mode: "default" });

  // --- superadmin ---
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, SEED_ADMIN_EMAIL))
    .limit(1);

  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      role: "superadmin",
      name: "Anton",
      email: SEED_ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(SEED_ADMIN_PASSWORD, 10),
      status: "active",
    });
    console.log(`✓ superadmin skapad: ${SEED_ADMIN_EMAIL} / ${SEED_ADMIN_PASSWORD}`);
  } else {
    console.log(`· superadmin finns redan: ${SEED_ADMIN_EMAIL}`);
  }

  // --- demo-företag ---
  for (const b of demoBusinesses) {
    const existing = await db.select().from(businesses).where(eq(businesses.slug, b.slug)).limit(1);
    if (existing.length > 0) {
      console.log(`· business finns redan: /${b.slug}`);
      continue;
    }

    const { plan, priceGs, ...biz } = b;
    await db.insert(businesses).values({
      ...biz,
      publishedAt: biz.status === "published" ? new Date() : null,
      whatsappVerifiedAt: new Date(),
    });

    const [row] = await db.select().from(businesses).where(eq(businesses.slug, b.slug)).limit(1);
    const businessId = row.id;

    const starts = new Date();
    const expires = new Date(starts);
    expires.setFullYear(expires.getFullYear() + 1);

    await db.insert(subscriptions).values({
      businessId,
      plan,
      priceGs,
      startsAt: starts,
      expiresAt: expires,
      status: biz.status === "published" ? "active" : "trial",
    });

    if (plan !== "basico") {
      await db.insert(businessModules).values({
        businessId,
        moduleKey: "gallery",
        isEnabled: true,
        enabledAt: new Date(),
      });
    }

    console.log(`✓ business skapad: /${b.slug} (${biz.status}, ${plan})`);
  }

  await pool.end();
  console.log("\nKlart. Logga in på /admin/login.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
