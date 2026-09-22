"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { ownedProduct } from "@/db/product-queries";
import { deleteMedia, itemImageTarget, setItemImage } from "@/db/item-media";
import { enabledModules } from "@/db/module-queries";
import { logActivity } from "@/lib/auth";
import { ownerContext, type OwnerContext } from "@/lib/owner-context";
import { PRODUCTS_MAX, productFromForm } from "@/lib/product-form";

export type ProductFormState = { error?: string; ok?: string };

/**
 * Produkt-CRUD för owner (PR-14). Samma tre kontroller som menyn: ownerContext()
 * (roll + tenant ur sessionen), att modulen faktiskt är påslagen för tenanten,
 * och att raden som ska ändras tillhör tenanten.
 *
 * Modulkontrollen ligger här och inte bara i UI:t: en kund vars produkt-modul
 * stängts av ska inte kunna fortsätta posta formuläret hon hade öppet. Datat
 * ligger kvar orört — avstängning döljer listan, den raderar den inte.
 */
async function productContext(): Promise<OwnerContext | null> {
  const ctx = await ownerContext();
  if (!ctx) return null;
  const modules = await enabledModules(ctx.business.id);
  return modules.has("products") ? ctx : null;
}

async function afterWrite(ctx: OwnerContext, action: string, meta: Record<string, unknown>) {
  await logActivity({ actorUserId: ctx.userId, businessId: ctx.business.id, action, meta });
  revalidateTag(`biz:${ctx.business.slug}`);
  revalidatePath("/mi-sitio");
}

/** Nästa sortOrder i listan — en ny produkt hamnar sist, aldrig först. */
async function nextSort(businessId: number) {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${products.sortOrder}), -1) + 1` })
    .from(products)
    .where(eq(products.businessId, businessId));
  return Number(row?.next ?? 0);
}

/** Lägger till eller uppdaterar en produkt. Samma formulär, samma validering. */
export async function saveProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const ctx = await productContext();
  if (!ctx) return { error: "No pudimos guardar. Entrá de nuevo." };

  const parsed = productFromForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos del producto." };
  const values = parsed.data;

  const productIdRaw = Number(formData.get("productId"));
  const existing = productIdRaw ? await ownedProduct(ctx.business.id, productIdRaw) : null;
  if (productIdRaw && !existing) return { error: "Ese producto ya no existe." };

  if (existing) {
    await db
      .update(products)
      .set({
        name: values.name,
        description: values.description || null,
        priceGs: values.priceGs,
        isVisible: values.isVisible,
      })
      .where(eq(products.id, existing.id));
    await afterWrite(ctx, "owner_product_updated", { productId: existing.id });
    return { ok: "Producto actualizado." };
  }

  const existingCount = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.businessId, ctx.business.id));
  if (existingCount.length >= PRODUCTS_MAX) {
    return { error: `Máximo ${PRODUCTS_MAX} productos.` };
  }

  await db.insert(products).values({
    businessId: ctx.business.id,
    name: values.name,
    description: values.description || null,
    priceGs: values.priceGs,
    isVisible: values.isVisible,
    sortOrder: await nextSort(ctx.business.id),
  });

  await afterWrite(ctx, "owner_product_added", { name: values.name });
  return { ok: "Producto agregado." };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const ctx = await productContext();
  if (!ctx) return;

  const productId = Number(formData.get("productId"));
  const product = await ownedProduct(ctx.business.id, productId);
  if (!product) return;

  await db.delete(products).where(eq(products.id, productId));
  // Bilden går med produkten — annars ligger filen kvar på disken utan att
  // något pekar på den.
  await deleteMedia(ctx.business.id, [product.mediaId]);
  await afterWrite(ctx, "owner_product_deleted", { productId });
}

/** Tar bort produktens bild (R3-16). Produkten står kvar, utan bild. */
export async function removeProductImageAction(formData: FormData): Promise<void> {
  const ctx = await productContext();
  if (!ctx) return;

  const target = await itemImageTarget(ctx.business.id, "product", Number(formData.get("productId")));
  if (!target?.mediaId) return;

  await setItemImage(ctx.business.id, "product", target, null);
  await afterWrite(ctx, "owner_product_image_removed", { productId: target.id });
}

/**
 * Slår av och på synligheten. Egen åtgärd i stället för ett fält i
 * saveProductAction: att dölja dagens slutsålda produkt ska vara ett klick,
 * inte ett formulär att fylla i på nytt. Döljer på den publika sajten, ligger
 * kvar i panelen.
 */
export async function toggleProductVisibilityAction(formData: FormData): Promise<void> {
  const ctx = await productContext();
  if (!ctx) return;

  const productId = Number(formData.get("productId"));
  const product = await ownedProduct(ctx.business.id, productId);
  if (!product) return;

  await db.update(products).set({ isVisible: !product.isVisible }).where(eq(products.id, productId));
  await afterWrite(ctx, "owner_product_visibility", { productId, isVisible: !product.isVisible });
}

export async function moveProductAction(formData: FormData): Promise<void> {
  const ctx = await productContext();
  if (!ctx) return;

  const productId = Number(formData.get("productId"));
  const step = String(formData.get("direction")) === "up" ? -1 : 1;
  if (!(await ownedProduct(ctx.business.id, productId))) return;

  const siblings = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.businessId, ctx.business.id))
    .orderBy(asc(products.sortOrder), asc(products.id));

  const index = siblings.findIndex((s) => s.id === productId);
  const target = index + step;
  if (index < 0 || target < 0 || target >= siblings.length) return;

  // Hela ordningen skrivs om, samma skäl som för bilderna och menyn:
  // duplicerade sortOrder-värden gör ett värdebyte mellan två rader till en
  // no-op.
  const reordered = [...siblings];
  reordered[index] = siblings[target];
  reordered[target] = siblings[index];
  for (const [i, row] of reordered.entries()) {
    await db.update(products).set({ sortOrder: i }).where(eq(products.id, row.id));
  }

  await afterWrite(ctx, "owner_product_moved", { productId, direction: step });
}
