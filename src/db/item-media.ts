import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { media, menuItems, products } from "./schema";
import { enabledModules } from "./module-queries";
import type { ModuleKey } from "@/lib/modules";
import { deleteMediaFiles } from "@/lib/media";

/**
 * Bilder på rätter och produkter (R3-16). En bild per rad, via `media_id` på
 * `menu_items` / `products` — ingen migrering, kolumnerna och media-kinds
 * `menu_item` / `product` finns sedan 0000.
 */
export type ItemImageKind = "menu_item" | "product";

const MODULE_FOR: Record<ItemImageKind, ModuleKey> = { menu_item: "menu", product: "products" };

/**
 * Raden som bilden ska sitta på, om den tillhör tenanten och modulen är på —
 * annars null. Samma två kontroller som ägarens CRUD-åtgärder: en avstängd
 * modul tar inte emot uppladdningar, och ett id från en annan kund matchar
 * aldrig eftersom businessId står i WHERE-satsen.
 */
export async function itemImageTarget(
  businessId: number,
  kind: ItemImageKind,
  targetId: number,
): Promise<{ id: number; mediaId: number | null } | null> {
  if (!Number.isInteger(targetId) || targetId <= 0) return null;
  if (!(await enabledModules(businessId)).has(MODULE_FOR[kind])) return null;

  const table = kind === "menu_item" ? menuItems : products;
  const [row] = await db
    .select({ id: table.id, mediaId: table.mediaId })
    .from(table)
    .where(and(eq(table.id, targetId), eq(table.businessId, businessId)))
    .limit(1);
  return row ?? null;
}

/** Sätter (eller tar bort, med null) bilden på raden. Den gamla bilden raderas. */
export async function setItemImage(
  businessId: number,
  kind: ItemImageKind,
  target: { id: number; mediaId: number | null },
  mediaId: number | null,
): Promise<void> {
  const table = kind === "menu_item" ? menuItems : products;
  await db
    .update(table)
    .set({ mediaId })
    .where(and(eq(table.id, target.id), eq(table.businessId, businessId)));
  if (target.mediaId && target.mediaId !== mediaId) await deleteMedia(businessId, [target.mediaId]);
}

/**
 * Raderar media-rader och deras filer. Tenant-check i WHERE-satsen: ett id
 * från en annan kund raderas aldrig, även om det skulle smita in i listan.
 */
export async function deleteMedia(businessId: number, ids: (number | null | undefined)[]): Promise<void> {
  const wanted = ids.filter((id): id is number => typeof id === "number" && id > 0);
  if (wanted.length === 0) return;

  const rows = await db
    .select({ id: media.id, variantsJson: media.variantsJson })
    .from(media)
    .where(and(eq(media.businessId, businessId), inArray(media.id, wanted)));
  for (const row of rows) await deleteMediaFiles(businessId, row.variantsJson ?? {});
  if (rows.length > 0) {
    await db.delete(media).where(
      and(
        eq(media.businessId, businessId),
        inArray(
          media.id,
          rows.map((r) => r.id),
        ),
      ),
    );
  }
}
