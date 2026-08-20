import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getRedirectTarget, getSiteBySlug } from "@/db/site-queries";
import { isReservedSlug } from "@/lib/slug";
import { RenderSite, siteMetadata } from "@/components/site/render-site";

/**
 * Publika kundsajten. ISR med revalidateTag('biz:<slug>') vid varje write —
 * Hostinger-noden serverar cachat och rör inte MySQL per besök.
 *
 * Inga searchParams här: de hade tvingat sidan dynamisk. Förhandsvisning
 * ligger på /preview/[slug] och nås via ?preview= tack vare en rewrite i
 * middleware.
 */
export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

async function publishedSite(slugRaw: string) {
  const slug = slugRaw.toLowerCase();
  if (isReservedSlug(slug)) return null;

  const site = await getSiteBySlug(slug);
  if (!site || site.business.status !== "published") return null;
  return site;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const site = await publishedSite(slug);
  if (!site) return { title: "No encontrado", robots: { index: false, follow: false } };
  return siteMetadata(site, { isPreview: false });
}

export default async function SitePage({ params }: Params) {
  const { slug } = await params;
  const site = await publishedSite(slug);

  if (!site) {
    // Har slugen bytts pekar vi vidare permanent i stället för att tappa
    // besökaren och den ranking som byggts upp.
    //
    // Statuskoden blir 308, inte 301: App Router kan inte sätta status på en
    // sidrespons, och permanentRedirect() svarar 308. Google behandlar 308
    // som 301 för indexering — skillnaden är att 308 inte får byta metod på
    // en POST. Verifierat mot en riktig databas: /gammal-slug → 308 → /ny-slug.
    const target = await getRedirectTarget(slug.toLowerCase());
    if (target && target !== slug.toLowerCase()) permanentRedirect(`/${target}`);
    notFound();
  }

  return <RenderSite site={site} isPreview={false} />;
}
