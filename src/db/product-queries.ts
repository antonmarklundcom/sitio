import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import { products } from "./schema";

export type ProductRow = {
  id: number;
  name: string;
  description: string | null;
  priceGs: number | null;
  isVisible: boolean;
  sortOrder: number;
};

/** Hela produktlistan för ett business, i visningsordning. */
export async function getProducts(businessId: number): Promise<ProductRow[]> {
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.businessId, businessId))
    .orderBy(asc(products.sortOrder), asc(products.id));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    priceGs: row.priceGs,
    isVisible: row.isVisible,
    sortOrder: row.sortOrder,
  }));
}

/** Listan som den publika sajten visar den: dolda produkter döljs. */
export function publicProducts(list: ProductRow[]): ProductRow[] {
  return list.filter((p) => p.isVisible);
}

/** Produkten om den tillhör tenanten — annars null. Tenant-check i WHERE-satsen. */
export async function ownedProduct(businessId: number, productId: number) {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.businessId, businessId)))
    .limit(1);
  return row ?? null;
}
