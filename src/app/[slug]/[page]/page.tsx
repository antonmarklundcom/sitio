import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteBySlug } from "@/db/site-queries";
import { isReservedSlug } from "@/lib/slug";
import { RenderSubPage, subPageMetadata } from "@/components/site/render-subpage";

/**
 * En extra sida på en publicerad kundsajt (extra_pages, R3-25). Samma ISR och
 * samma cache-tagg som startsidan: sidorna ligger i getSiteBySlug(), så en
 * ändring i admin eller owner-panelen invaliderar båda med revalidateTag.
 * Avstängd modul, avstängd sida eller okänd sida ⇒ 404.
 */
export const revalidate = 3600;

type Params = { params: Promise<{ slug: string; page: string }> };

async function publishedPage(slugRaw: string, pageSlug: string) {
  const slug = slugRaw.toLowerCase();
  if (isReservedSlug(slug)) return null;
  const site = await getSiteBySlug(slug);
  if (!site || site.business.status !== "published") return null;
  const page = site.pages.find((p) => p.pageSlug === pageSlug.toLowerCase());
  return page ? { site, page } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, page } = await params;
  const found = await publishedPage(slug, page);
  if (!found) return { title: "No encontrado", robots: { index: false, follow: false } };
  return subPageMetadata(found.site, found.page, { isPreview: false });
}

export default async function SubPage({ params }: Params) {
  const { slug, page } = await params;
  const found = await publishedPage(slug, page);
  if (!found) notFound();
  return <RenderSubPage site={found.site} page={found.page} isPreview={false} />;
}
