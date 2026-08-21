import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "./index";
import { businesses, businessModules, media, slugRedirects } from "./schema";
import type { Business, Media } from "./schema";
import { getMenu, publicMenu, type MenuSectionRow } from "./menu-queries";

export type SiteData = {
  business: Business;
  photos: Media[];
  logo: Media | null;
  hero: Media | null;
  modules: string[];
  /** Menyn, redan filtrerad: tom när modulen är av eller inget är upplagt. */
  menu: MenuSectionRow[];
};

async function loadSite(slug: string): Promise<SiteData | null> {
  const [business] = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (!business) return null;

  const [mediaRows, moduleRows] = await Promise.all([
    db
      .select()
      .from(media)
      .where(and(eq(media.businessId, business.id), ne(media.kind, "receipt")))
      .orderBy(asc(media.sortOrder), asc(media.id)),
    db
      .select({ moduleKey: businessModules.moduleKey })
      .from(businessModules)
      .where(and(eq(businessModules.businessId, business.id), eq(businessModules.isEnabled, true))),
  ]);

  const photos = mediaRows.filter((m) => m.kind === "photo");

  // Menyn hämtas bara när modulen är på: en avstängd modul ska inte kosta en
  // extra fråga per sajt, och datat ligger kvar orört tills den slås på igen.
  const moduleKeys = moduleRows.map((m) => m.moduleKey);
  const menu = moduleKeys.includes("menu") ? publicMenu(await getMenu(business.id)) : [];

  return {
    business,
    photos,
    logo: mediaRows.find((m) => m.kind === "logo") ?? null,
    hero: photos.find((m) => m.id === business.heroMediaId) ?? photos[0] ?? null,
    modules: moduleKeys,
    menu,
  };
}

/**
 * ISR: cachas per slug och invalideras med revalidateTag('biz:<slug>') vid
 * varje write i admin. Det är hela skalbarhetsstoryn — en enda Node-process
 * på Hostinger ska serva 200 sajter utan att röra MySQL per besök.
 */
export function getSiteBySlug(slug: string) {
  return unstable_cache(() => loadSite(slug), ["site", slug], {
    tags: [`biz:${slug}`],
    revalidate: 3600,
  })();
}

/** Slug som pekar om (301). Cachad separat — ändras nästan aldrig. */
export function getRedirectTarget(oldSlug: string) {
  return unstable_cache(
    async () => {
      const [row] = await db
        .select({ businessId: slugRedirects.businessId })
        .from(slugRedirects)
        .where(eq(slugRedirects.oldSlug, oldSlug))
        .limit(1);
      if (!row) return null;

      const [target] = await db
        .select({ slug: businesses.slug, status: businesses.status })
        .from(businesses)
        .where(eq(businesses.id, row.businessId))
        .limit(1);
      return target?.status === "published" ? target.slug : null;
    },
    ["slug-redirect", oldSlug],
    { tags: [`redirect:${oldSlug}`], revalidate: 3600 },
  )();
}
