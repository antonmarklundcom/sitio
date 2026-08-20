import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteBySlug } from "@/db/site-queries";
import { isReservedSlug } from "@/lib/slug";
import { verifyPreviewToken } from "@/lib/preview";
import { RenderSite, siteMetadata } from "@/components/site/render-site";

/**
 * Förhandsvisning av en sajt oavsett status. Alltid dynamisk — token måste
 * kontrolleras vid varje anrop och får aldrig cachas.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

async function previewSite(slugRaw: string, token: string | undefined) {
  const slug = slugRaw.toLowerCase();
  if (isReservedSlug(slug)) return null;

  const site = await getSiteBySlug(slug);
  if (!site) return null;
  if (!verifyPreviewToken(site.business.id, token)) return null;
  return site;
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { preview } = await searchParams;
  const site = await previewSite(slug, preview);
  if (!site) return { title: "No encontrado", robots: { index: false, follow: false } };
  return siteMetadata(site, { isPreview: true });
}

export default async function PreviewPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const site = await previewSite(slug, preview);
  if (!site) notFound();

  return <RenderSite site={site} isPreview />;
}
