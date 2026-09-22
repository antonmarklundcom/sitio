import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import { pages } from "./schema";
import { pageContent, type PageType } from "@/lib/pages";

export type PageRow = {
  id: number;
  pageSlug: string;
  type: PageType;
  title: string;
  body: string;
  isEnabled: boolean;
  sortOrder: number;
};

/** Alla sidor för ett business, i menyordning (R3-25). */
export async function getPages(businessId: number): Promise<PageRow[]> {
  const rows = await db
    .select()
    .from(pages)
    .where(eq(pages.businessId, businessId))
    .orderBy(asc(pages.sortOrder), asc(pages.id));
  return rows.map((r) => ({
    id: r.id,
    pageSlug: r.pageSlug,
    type: r.type,
    title: r.title,
    body: pageContent(r.contentJson).body,
    isEnabled: r.isEnabled,
    sortOrder: r.sortOrder,
  }));
}

/** Sidan om den tillhör tenanten — annars null. Tenant-check i WHERE-satsen. */
export async function ownedPage(businessId: number, pageId: number) {
  if (!Number.isInteger(pageId) || pageId <= 0) return null;
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.businessId, businessId)))
    .limit(1);
  return row ?? null;
}
