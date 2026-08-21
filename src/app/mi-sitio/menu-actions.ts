"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { menuItems, menuSections } from "@/db/schema";
import { ownedItem, ownedSection } from "@/db/menu-queries";
import { enabledModules } from "@/db/module-queries";
import { logActivity } from "@/lib/auth";
import { ownerContext, type OwnerContext } from "@/lib/owner-context";
import {
  MENU_MAX_ITEMS_PER_SECTION,
  MENU_MAX_SECTIONS,
  menuItemFromForm,
  menuSectionSchema,
} from "@/lib/menu-form";

export type MenuFormState = { error?: string; ok?: string };

/**
 * Meny-CRUD för owner (PR-13). Varje åtgärd börjar i samma tre kontroller:
 * ownerContext() (roll + tenant ur sessionen), att modulen faktiskt är påslagen
 * för tenanten, och att raden som ska ändras tillhör tenanten.
 *
 * Modulkontrollen är inte pynt: en kund vars meny-modul stängts av ska inte
 * kunna fortsätta fylla på menyn genom att posta formuläret hon hade öppet.
 * Datat ligger kvar orört — avstängning döljer menyn, den raderar den inte.
 */
async function menuContext(): Promise<OwnerContext | null> {
  const ctx = await ownerContext();
  if (!ctx) return null;
  const modules = await enabledModules(ctx.business.id);
  return modules.has("menu") ? ctx : null;
}

async function afterWrite(ctx: OwnerContext, action: string, meta: Record<string, unknown>) {
  await logActivity({ actorUserId: ctx.userId, businessId: ctx.business.id, action, meta });
  revalidateTag(`biz:${ctx.business.slug}`);
  revalidatePath("/mi-sitio");
}

/** Nästa sortOrder i en lista — ny rad hamnar sist, aldrig först. */
async function nextSort(table: typeof menuSections | typeof menuItems, where: ReturnType<typeof eq>) {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${table.sortOrder}), -1) + 1` })
    .from(table)
    .where(where);
  return Number(row?.next ?? 0);
}

export async function addSectionAction(_prev: MenuFormState, formData: FormData): Promise<MenuFormState> {
  const ctx = await menuContext();
  if (!ctx) return { error: "No pudimos guardar. Entrá de nuevo." };

  const parsed = menuSectionSchema.safeParse({ name: formData.get("name") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá el nombre." };

  const existing = await db
    .select({ id: menuSections.id })
    .from(menuSections)
    .where(eq(menuSections.businessId, ctx.business.id));
  if (existing.length >= MENU_MAX_SECTIONS) {
    return { error: `Máximo ${MENU_MAX_SECTIONS} secciones. Con más, nadie encuentra nada.` };
  }

  await db.insert(menuSections).values({
    businessId: ctx.business.id,
    name: parsed.data.name,
    sortOrder: await nextSort(menuSections, eq(menuSections.businessId, ctx.business.id)),
  });

  await afterWrite(ctx, "owner_menu_section_added", { name: parsed.data.name });
  return { ok: "Sección agregada." };
}

export async function renameSectionAction(formData: FormData): Promise<void> {
  const ctx = await menuContext();
  if (!ctx) return;

  const sectionId = Number(formData.get("sectionId"));
  const parsed = menuSectionSchema.safeParse({ name: formData.get("name") ?? "" });
  if (!parsed.success) return;
  if (!(await ownedSection(ctx.business.id, sectionId))) return;

  await db.update(menuSections).set({ name: parsed.data.name }).where(eq(menuSections.id, sectionId));
  await afterWrite(ctx, "owner_menu_section_renamed", { sectionId });
}

/**
 * Raderar en sektion och dess rätter. Ordningen spelar roll: rätterna först,
 * annars kan en avbruten körning lämna rätter utan sektion — rader som inte
 * syns någonstans men fortfarande räknas mot taket.
 */
export async function deleteSectionAction(formData: FormData): Promise<void> {
  const ctx = await menuContext();
  if (!ctx) return;

  const sectionId = Number(formData.get("sectionId"));
  if (!(await ownedSection(ctx.business.id, sectionId))) return;

  await db
    .delete(menuItems)
    .where(and(eq(menuItems.businessId, ctx.business.id), eq(menuItems.sectionId, sectionId)));
  await db.delete(menuSections).where(eq(menuSections.id, sectionId));

  await afterWrite(ctx, "owner_menu_section_deleted", { sectionId });
}

export async function moveSectionAction(formData: FormData): Promise<void> {
  const ctx = await menuContext();
  if (!ctx) return;

  const sectionId = Number(formData.get("sectionId"));
  const step = String(formData.get("direction")) === "up" ? -1 : 1;
  if (!(await ownedSection(ctx.business.id, sectionId))) return;

  const siblings = await db
    .select({ id: menuSections.id })
    .from(menuSections)
    .where(eq(menuSections.businessId, ctx.business.id))
    .orderBy(asc(menuSections.sortOrder), asc(menuSections.id));

  const index = siblings.findIndex((s) => s.id === sectionId);
  const target = index + step;
  if (index < 0 || target < 0 || target >= siblings.length) return;

  // Hela ordningen skrivs om, samma skäl som för bilderna: duplicerade
  // sortOrder-värden gör ett värdebyte mellan två rader till en no-op.
  const reordered = [...siblings];
  reordered[index] = siblings[target];
  reordered[target] = siblings[index];
  for (const [i, row] of reordered.entries()) {
    await db.update(menuSections).set({ sortOrder: i }).where(eq(menuSections.id, row.id));
  }

  await afterWrite(ctx, "owner_menu_section_moved", { sectionId, direction: step });
}

/** Lägger till eller uppdaterar en rätt. Samma formulär, samma validering. */
export async function saveItemAction(_prev: MenuFormState, formData: FormData): Promise<MenuFormState> {
  const ctx = await menuContext();
  if (!ctx) return { error: "No pudimos guardar. Entrá de nuevo." };

  const sectionId = Number(formData.get("sectionId"));
  const section = await ownedSection(ctx.business.id, sectionId);
  if (!section) return { error: "Esa sección ya no existe." };

  const parsed = menuItemFromForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos del plato." };
  const values = parsed.data;

  const itemIdRaw = Number(formData.get("itemId"));
  const existing = itemIdRaw ? await ownedItem(ctx.business.id, itemIdRaw) : null;
  if (itemIdRaw && !existing) return { error: "Ese plato ya no existe." };

  if (existing) {
    await db
      .update(menuItems)
      .set({
        sectionId,
        name: values.name,
        description: values.description || null,
        priceGs: values.priceGs,
        isAvailable: values.isAvailable,
      })
      .where(eq(menuItems.id, existing.id));
    await afterWrite(ctx, "owner_menu_item_updated", { itemId: existing.id });
    return { ok: "Plato actualizado." };
  }

  const inSection = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.businessId, ctx.business.id), eq(menuItems.sectionId, sectionId)));
  if (inSection.length >= MENU_MAX_ITEMS_PER_SECTION) {
    return { error: `Máximo ${MENU_MAX_ITEMS_PER_SECTION} platos por sección.` };
  }

  await db.insert(menuItems).values({
    businessId: ctx.business.id,
    sectionId,
    name: values.name,
    description: values.description || null,
    priceGs: values.priceGs,
    isAvailable: values.isAvailable,
    sortOrder: await nextSort(
      menuItems,
      and(eq(menuItems.businessId, ctx.business.id), eq(menuItems.sectionId, sectionId))!,
    ),
  });

  await afterWrite(ctx, "owner_menu_item_added", { sectionId, name: values.name });
  return { ok: "Plato agregado." };
}

export async function deleteItemAction(formData: FormData): Promise<void> {
  const ctx = await menuContext();
  if (!ctx) return;

  const itemId = Number(formData.get("itemId"));
  if (!(await ownedItem(ctx.business.id, itemId))) return;

  await db.delete(menuItems).where(eq(menuItems.id, itemId));
  await afterWrite(ctx, "owner_menu_item_deleted", { itemId });
}

/**
 * Slår av och på "hay hoy". Egen åtgärd i stället för ett fält i
 * saveItemAction: att markera dagens slutsålda rätt ska vara ett klick, inte
 * ett formulär att fylla i på nytt.
 */
export async function toggleItemAvailabilityAction(formData: FormData): Promise<void> {
  const ctx = await menuContext();
  if (!ctx) return;

  const itemId = Number(formData.get("itemId"));
  const item = await ownedItem(ctx.business.id, itemId);
  if (!item) return;

  await db.update(menuItems).set({ isAvailable: !item.isAvailable }).where(eq(menuItems.id, itemId));
  await afterWrite(ctx, "owner_menu_item_availability", { itemId, isAvailable: !item.isAvailable });
}

export async function moveItemAction(formData: FormData): Promise<void> {
  const ctx = await menuContext();
  if (!ctx) return;

  const itemId = Number(formData.get("itemId"));
  const step = String(formData.get("direction")) === "up" ? -1 : 1;
  const item = await ownedItem(ctx.business.id, itemId);
  if (!item) return;

  const siblings = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.businessId, ctx.business.id), eq(menuItems.sectionId, item.sectionId)))
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));

  const index = siblings.findIndex((s) => s.id === itemId);
  const target = index + step;
  if (index < 0 || target < 0 || target >= siblings.length) return;

  const reordered = [...siblings];
  reordered[index] = siblings[target];
  reordered[target] = siblings[index];
  for (const [i, row] of reordered.entries()) {
    await db.update(menuItems).set({ sortOrder: i }).where(eq(menuItems.id, row.id));
  }

  await afterWrite(ctx, "owner_menu_item_moved", { itemId, direction: step });
}
