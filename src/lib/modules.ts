import { z } from "zod";

/**
 * Modulregistret. En modul är en rad i `business_modules` — att slå på den är
 * en flagga, aldrig en migrering (PLAN.md §1.6). Nycklarna MÅSTE matcha enumet
 * i schema.ts; zod-schemat nedan är porten som ser till att de gör det.
 */
export const MODULE_KEYS = ["gallery", "menu", "products", "extra_pages", "booking"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const moduleKeySchema = z.enum(MODULE_KEYS);

export type ModuleMeta = {
  key: ModuleKey;
  /** Kort etikett i superadmin-UI. Svenska — adminet är ditt, inte kundens. */
  label: string;
  /** Vad kunden köper. */
  summary: string;
  /** Vad som faktiskt händer i koden när flaggan slås på. */
  effect: string;
  /** PR där funktionen byggs. Saknas den är modulen byggd. */
  plannedIn?: string;
};

/**
 * Ordningen är den kunden möter dem i: galleriet är upsellen som säljer sig
 * själv, bokning ligger längst bort i fas 3.
 */
export const MODULES: ModuleMeta[] = [
  {
    key: "gallery",
    label: "Galleri",
    summary: "Upp till 20 foton i stället för 8, och alla visas på sajten.",
    effect:
      "Höjer fototaket i /api/upload från 8 till 20 och gör att temat renderar hela fotoserien i stället för de tre till sex första.",
  },
  {
    key: "menu",
    label: "Meny",
    summary: "Meny med sektioner, rätter och priser i guaraníes.",
    effect: "Egen CRUD för owner och en menysektion i gastronomia-temat.",
    plannedIn: "PR-13",
  },
  {
    key: "products",
    label: "Produkter",
    summary: "Produktlista med pris eller “consultar”.",
    effect: "Samma mönster som menyn, renderas i comercio-temat.",
    plannedIn: "PR-14",
  },
  {
    key: "extra_pages",
    label: "Extra sidor",
    summary: "3–6 undersidor: /servicios, /nosotros …",
    effect: "pages-tabellen, navigering i temat och utökad sitemap.",
    plannedIn: "PR-18",
  },
  {
    key: "booking",
    label: "Bokning",
    summary: "Turno-förfrågan med förifyllt WhatsApp-meddelande.",
    effect: "Formulär i temat som bygger en wa.me-länk.",
    plannedIn: "fas 3",
  },
];

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

export function moduleMeta(key: ModuleKey): ModuleMeta {
  const meta = BY_KEY.get(key);
  // Registret täcker hela enumet — saknas en nyckel är det ett programmeringsfel.
  if (!meta) throw new Error(`Okänd modulnyckel: ${key}`);
  return meta;
}

/**
 * Moduler vars funktion finns i koden i dag. Övriga går att slå på — datat och
 * faktureringen ska kunna ligga före implementationen — men adminet säger det
 * rakt ut i stället för att låtsas att flaggan gör något, precis som
 * temaväljaren gör med teman som inte är byggda.
 */
export function isModuleBuilt(key: ModuleKey): boolean {
  return !moduleMeta(key).plannedIn;
}
