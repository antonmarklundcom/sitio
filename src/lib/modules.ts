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
    label: "Galería",
    summary: "Hasta 20 fotos en lugar de 8, y todas se muestran en el sitio.",
    effect:
      "Aumenta el límite de fotos en /api/upload de 8 a 20 y hace que el tema muestre toda la serie de fotos en lugar de las primeras tres a seis.",
  },
  {
    key: "menu",
    label: "Menú",
    summary: "Menú con secciones, platos y precios en guaraníes.",
    effect:
      "Le da al dueño un editor de menú en /mi-sitio y muestra el menú en el sitio: una sección propia en gastronomia y un componente compartido en los demás temas. Las lecturas se registran como menu_view.",
  },
  {
    key: "products",
    label: "Productos",
    summary: "Lista de productos con precio o “consultar”.",
    effect:
      "Sigue el mismo patrón que el menú: editor en /mi-sitio y catálogo en el sitio. Las lecturas se registran como products_view.",
  },
  {
    key: "extra_pages",
    label: "Páginas adicionales",
    summary: "Hasta 6 páginas internas: /servicios, /nosotros …",
    effect:
      "Las páginas se crean acá en /admin (el cliente solo edita el texto en /mi-sitio). Aparecen como enlaces bajo la portada y en el mapa del sitio.",
  },
  {
    key: "booking",
    label: "Reservas",
    summary: "Pedido de turno desde la página: servicio, día y hora, directo a la bandeja del dueño.",
    effect:
      "El formulario del cierre pasa a ser un pedido de turno (servicio, día, hora). Cada pedido queda en /mi-sitio → Consultas con un botón para responder por WhatsApp. Pensado para el plan Pro (growth-1).",
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
