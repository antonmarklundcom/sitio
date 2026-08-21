import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import { menuItems, menuSections } from "./schema";

export type MenuItemRow = {
  id: number;
  sectionId: number;
  name: string;
  description: string | null;
  priceGs: number | null;
  isAvailable: boolean;
  sortOrder: number;
};

export type MenuSectionRow = {
  id: number;
  name: string;
  sortOrder: number;
  items: MenuItemRow[];
};

/**
 * Hela menyn för ett business, sektioner och rätter i visningsordning.
 *
 * Två frågor, inte en join: en sektion utan rätter ska finnas kvar i listan
 * (owner bygger den ju uppifrån och ner), och en left join hade gjort tomma
 * sektioner till en rad med bara nullkolumner att filtrera bort.
 */
export async function getMenu(businessId: number): Promise<MenuSectionRow[]> {
  const [sections, items] = await Promise.all([
    db
      .select()
      .from(menuSections)
      .where(eq(menuSections.businessId, businessId))
      .orderBy(asc(menuSections.sortOrder), asc(menuSections.id)),
    db
      .select()
      .from(menuItems)
      .where(eq(menuItems.businessId, businessId))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id)),
  ]);

  return sections.map((section) => ({
    id: section.id,
    name: section.name,
    sortOrder: section.sortOrder,
    items: items
      .filter((item) => item.sectionId === section.id)
      .map((item) => ({
        id: item.id,
        sectionId: item.sectionId,
        name: item.name,
        description: item.description,
        priceGs: item.priceGs,
        isAvailable: item.isAvailable,
        sortOrder: item.sortOrder,
      })),
  }));
}

/** Menyn som den publika sajten visar den: slutsålda rätter döljs. */
export function publicMenu(menu: MenuSectionRow[]): MenuSectionRow[] {
  return menu
    .map((section) => ({ ...section, items: section.items.filter((i) => i.isAvailable) }))
    .filter((section) => section.items.length > 0);
}

/** Sektionen om den tillhör tenanten — annars null. Tenant-check i WHERE-satsen. */
export async function ownedSection(businessId: number, sectionId: number) {
  const [row] = await db
    .select()
    .from(menuSections)
    .where(and(eq(menuSections.id, sectionId), eq(menuSections.businessId, businessId)))
    .limit(1);
  return row ?? null;
}

/** Rätten om den tillhör tenanten — annars null. */
export async function ownedItem(businessId: number, itemId: number) {
  const [row] = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.id, itemId), eq(menuItems.businessId, businessId)))
    .limit(1);
  return row ?? null;
}
