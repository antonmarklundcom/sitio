import type { MetadataRoute } from "next";
import { getPublishedPageLinks, getPublishedSlugs } from "@/db/queries";
import { absoluteUrl } from "@/lib/env";

/**
 * Endast published-sajter. Draft, pending_review, paused och archived svarar
 * 404 och hör därför inte hemma här — en sitemap som listar 404:or bränner
 * crawlbudget på hela domänen, inte bara på den enskilda sajten.
 *
 * Dynamisk, inte prerenderad: en sitemap som bakas vid bygget kräver en
 * databas under `next build` och skulle dessutom bli inaktuell så fort en
 * sajt publiceras. Crawlers hämtar den sällan, så kostnaden är försumbar.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, pageLinks] = await Promise.all([getPublishedSlugs(), getPublishedPageLinks()]);

  return [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    { url: absoluteUrl("/registro"), changeFrequency: "monthly", priority: 0.8 },
    ...slugs.map((s) => ({
      url: absoluteUrl(`/${s.slug}`),
      lastModified: s.updatedAt ?? new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // Extra sidor (R3-25), bara när sidan och modulen är på.
    ...pageLinks.map((p) => ({
      url: absoluteUrl(`/${p.slug}/${p.pageSlug}`),
      lastModified: p.updatedAt ?? new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
