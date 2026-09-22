import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import { media, products } from "./schema";
import { itemImage, type ItemImage } from "@/lib/media-shared";

export type ProductRow = {
  id: number;
  name: string;
  description: string | null;
  priceGs: number | null;
  isVisible: boolean;
  sortOrder: number;
  /** Produktbilden (R3-16), eller null. */
  image: ItemImage | null;
};

/** Hela produktlistan för ett business, i visningsordning. */
export async function getProducts(businessId: number): Promise<ProductRow[]> {
  const rows = await db
    .select({
      product: products,
      image: { variantsJson: media.variantsJson, width: media.width, height: media.height },
    })
    .from(products)
    // businessId i join-villkoret också: en media_id som pekar på en annan
    // kunds bild ska ge ingen bild, inte den andras.
    .leftJoin(media, and(eq(media.id, products.mediaId), eq(media.businessId, products.businessId)))
    .where(eq(products.businessId, businessId))
    .orderBy(asc(products.sortOrder), asc(products.id));

  return rows.map(({ product: row, image }) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    priceGs: row.priceGs,
    isVisible: row.isVisible,
    sortOrder: row.sortOrder,
    image: itemImage(businessId, image),
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
