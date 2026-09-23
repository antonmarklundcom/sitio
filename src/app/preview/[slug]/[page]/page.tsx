import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSiteBySlug } from "@/db/site-queries";
import { isReservedSlug } from "@/lib/slug";
import { verifyPreviewToken } from "@/lib/preview";
import { RenderSubPage, subPageMetadata } from "@/components/site/render-subpage";

/** Förhandsvisning av en extra sida (R3-25). Alltid dynamisk, som /preview/[slug]. */
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ slug: string; page: string }>;
  searchParams: Promise<{ preview?: string }>;
};

async function previewPage(slugRaw: string, pageSlug: string, token: string | undefined) {
  const slug = slugRaw.toLowerCase();
  if (isReservedSlug(slug)) return null;
  const site = await getSiteBySlug(slug);
  if (!site || !verifyPreviewToken(site.business.id, token)) return null;
  const page = site.pages.find((p) => p.pageSlug === pageSlug.toLowerCase());
  return page ? { site, page } : null;
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { slug, page } = await params;
  const { preview } = await searchParams;
  const found = await previewPage(slug, page, preview);
  if (!found) return { title: "No encontrado", robots: { index: false, follow: false } };
  return subPageMetadata(found.site, found.page, { isPreview: true });
}

export default async function PreviewSubPage({ params, searchParams }: Params) {
  const { slug, page } = await params;
  const { preview } = await searchParams;
  const found = await previewPage(slug, page, preview);
  if (!found) notFound();
  // Publicerad sajt: samma sida finns publikt (site.pages är samma urval som
  // /[slug]/[page] visar), så länken leder dit i stället (R3-41).
  if (found.site.business.status === "published") redirect(`/${found.site.business.slug}/${found.page.pageSlug}`);
  return <RenderSubPage site={found.site} page={found.page} isPreview previewToken={preview} />;
}
