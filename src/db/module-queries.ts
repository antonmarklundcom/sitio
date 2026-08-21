import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { businessModules } from "./schema";
import { MAX_PHOTOS_BASE, MAX_PHOTOS_GALLERY } from "@/lib/media-shared";
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules";

export type ModuleState = { key: ModuleKey; enabled: boolean; enabledAt: Date | null };

/**
 * Alla moduler för ett business, även de som aldrig slagits på. Adminet ska
 * visa hela registret — en modul som saknar rad är avstängd, inte osynlig.
 */
export async function listModuleStates(businessId: number): Promise<ModuleState[]> {
  const rows = await db
    .select({
      moduleKey: businessModules.moduleKey,
      isEnabled: businessModules.isEnabled,
      enabledAt: businessModules.enabledAt,
    })
    .from(businessModules)
    .where(eq(businessModules.businessId, businessId));

  const byKey = new Map(rows.map((r) => [r.moduleKey, r]));
  return MODULE_KEYS.map((key) => {
    const row = byKey.get(key);
    return { key, enabled: row?.isEnabled ?? false, enabledAt: row?.enabledAt ?? null };
  });
}

/** Bara de påslagna nycklarna. Det temana och owner-vyn frågar efter. */
export async function enabledModules(businessId: number): Promise<Set<ModuleKey>> {
  const rows = await db
    .select({ moduleKey: businessModules.moduleKey })
    .from(businessModules)
    .where(and(eq(businessModules.businessId, businessId), eq(businessModules.isEnabled, true)));
  return new Set(rows.map((r) => r.moduleKey));
}

/**
 * Fototaket för en sajt. Ligger här, och inte i uppladdningsrutten, för att
 * owner-vyn och rutten annars kan råka svara olika på samma fråga: panelen
 * hade sagt "12/20" medan rutten nekade den nionde bilden.
 */
export async function photoLimitFor(businessId: number): Promise<number> {
  const [row] = await db
    .select({ isEnabled: businessModules.isEnabled })
    .from(businessModules)
    .where(and(eq(businessModules.businessId, businessId), eq(businessModules.moduleKey, "gallery")))
    .limit(1);
  return row?.isEnabled ? MAX_PHOTOS_GALLERY : MAX_PHOTOS_BASE;
}
