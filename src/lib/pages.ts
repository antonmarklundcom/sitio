import { z } from "zod";
import { slugify } from "./slug";

/**
 * Extra sidor (extra_pages-modulen, R3-25/PR-18). Klientsäkert: typerna,
 * standardtitlarna och valideringen delas av adminets formulär, owner-panelen
 * och renderingen. Ingen migrering — `pages` finns i schemat sedan 0000.
 *
 * Innehållet är avsiktligt enkelt: en titel och en brödtext i stycken. Sidtypen
 * avgör vilket befintligt block som följer efter texten (tjänsterna, bilderna,
 * menyn, produkterna, adressen) — det är samma data som startsidan, inte en
 * andra kopia som kunden måste hålla i synk.
 */
export const PAGE_TYPES = ["servicios", "nosotros", "galeria", "menu", "productos", "contacto", "custom"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_TYPE_DEFAULTS: Record<PageType, { title: string; slug: string; hint: string }> = {
  servicios: { title: "Servicios", slug: "servicios", hint: "Texto + la lista de servicios del sitio." },
  nosotros: { title: "Nosotros", slug: "nosotros", hint: "La historia del negocio, en texto." },
  galeria: { title: "Galería", slug: "galeria", hint: "Texto + todas las fotos." },
  menu: { title: "Carta", slug: "carta", hint: "Texto + la carta (módulo menu)." },
  productos: { title: "Productos", slug: "productos", hint: "Texto + el catálogo (módulo products)." },
  contacto: { title: "Contacto", slug: "contacto", hint: "Texto + dirección, horario y mapa." },
  custom: { title: "", slug: "", hint: "Solo texto, con el título que elijas." },
};

/** 3–6 undersidor (PLAN.md §1.9). Fler blir en meny ingen läser på mobil. */
export const PAGES_MAX = 6;
export const PAGE_BODY_MAX = 6000;

export type PageContent = { body: string };

/** contentJson → innehåll. Allt som inte ser ut som `{ body: string }` blir tomt. */
export function pageContent(json: unknown): PageContent {
  const body = json && typeof json === "object" && typeof (json as { body?: unknown }).body === "string"
    ? (json as { body: string }).body
    : "";
  return { body };
}

/** Brödtext → stycken. Tomrad delar stycken; enstaka radbrytningar blir mellanslag. */
export function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** Meta description: första stycket, kapat vid ett ord, max 155 tecken. */
export function pageDescription(body: string): string | undefined {
  const first = paragraphs(body)[0];
  if (!first) return undefined;
  if (first.length <= 155) return first;
  const cut = first.slice(0, 155);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : 155).trimEnd()}…`;
}

/** Sidans slug: typens fasta slug, eller titeln slugifierad för `custom`. */
export function pageSlugFor(type: PageType, title: string, requested?: string): string {
  if (type !== "custom") return PAGE_TYPE_DEFAULTS[type].slug;
  return slugify(requested?.trim() || title).slice(0, 60);
}

const title = z.string().trim().min(2, "El título es muy corto.").max(120, "El título es muy largo.");
const body = z.string().max(PAGE_BODY_MAX, `El texto puede tener hasta ${PAGE_BODY_MAX} caracteres.`);

/** Adminets formulär för en ny sida. */
export const newPageSchema = z.object({
  type: z.enum(PAGE_TYPES, { message: "Elegí un tipo de página." }),
  title: title.optional().or(z.literal("")),
  pageSlug: z.string().trim().max(60).optional().or(z.literal("")),
});

/** Titel + text — det enda en owner får ändra, och det adminet redigerar i efterhand. */
export const pageContentSchema = z.object({ title, body });
