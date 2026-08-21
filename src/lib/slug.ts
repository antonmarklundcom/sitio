/**
 * Reserverade slugs. Valideras vid slug-sättning OCH i middleware —
 * en kundsajt får aldrig kapa en systemsökväg.
 */
export const RESERVED_SLUGS = new Set([
  "admin",
  "mi-sitio",
  "alta",
  "api",
  "media",
  "preview",
  "login",
  "logout",
  "precios",
  "contacto",
  "terminos",
  "privacidad",
  "sobre-nosotros",
  "blog",
  "ayuda",
  "soporte",
  "demo",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
  "_next",
  "static",
  "assets",
  "public",
  "www",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** Slugifiering med spansk teckenhantering (ñ -> n, accenter strippade). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export type SlugCheck = { ok: true; slug: string } | { ok: false; error: string };

export function validateSlug(raw: string): SlugCheck {
  const slug = raw.trim().toLowerCase();
  if (slug.length < 3) return { ok: false, error: "El enlace debe tener al menos 3 caracteres." };
  if (slug.length > 60) return { ok: false, error: "El enlace no puede superar 60 caracteres." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return {
      ok: false,
      error: "Solo minúsculas, números y guiones (sin guion al principio ni al final).",
    };
  if (isReservedSlug(slug)) return { ok: false, error: "Ese enlace está reservado por el sistema." };
  return { ok: true, slug };
}

/**
 * Första lediga slugen från en bas: "pizzeria-la-nona", annars -2, -3 …
 *
 * Används när ett utkast skapas åt kunden (intake, PR-10) och slugen ännu inte
 * är ett medvetet val. Superadmin sätter den riktiga slugen före publicering —
 * en slug som byts efter publicering kostar en 301-kedja.
 */
export function uniqueSlugCandidate(base: string, taken: Set<string>): string {
  const root = (slugify(base) || "negocio").slice(0, 52);
  let candidate = root;
  let n = 1;
  while (taken.has(candidate) || isReservedSlug(candidate)) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}
