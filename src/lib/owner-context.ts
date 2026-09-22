import "server-only";
import { getBusinessById } from "@/db/queries";
import { assertBusinessAccess, requireRole } from "@/lib/auth";
import { currentUser } from "@/lib/session";
import type { Business } from "@/db/schema";

export type OwnerContext = { userId: number; business: Business };

/**
 * Kontexten för meny- och produktredigering (R3-20): samma form som
 * OwnerContext plus vem som gör ändringen, så att loggen säger "admin_…" när
 * superadmin redigerat åt kunden och "owner_…" när kunden gjort det själv.
 */
export type EditorContext = OwnerContext & { actor: "owner" | "superadmin" };

/**
 * Kontexten varje owner-mutation börjar i. Den gör tre saker innan något rörs:
 * kräver rollen, hämtar tenanten ur SESSIONEN (aldrig ur formuläret) och
 * kontrollerar åtkomsten. businessId kommer alltså aldrig från klienten.
 *
 * Superadmin kan läsa en kunds vy via ?sitio=<id>, men får null här: valet
 * bärs inte i sessionen, och en mutation som gissar tenant är värre än en som
 * inte går att göra. Superadmin redigerar i /admin, där ändringarna loggas mot
 * rätt aktör.
 *
 * Ligger i lib/ och inte i en "use server"-fil: en sådan får bara exportera
 * async serveråtgärder, och den här hjälparen delas av flera.
 */
export async function ownerContext(): Promise<OwnerContext | null> {
  const session = await requireRole("owner", "superadmin");
  const user = await currentUser();

  const businessId = session.role === "owner" ? user?.businessId : undefined;
  if (!businessId) return null;

  await assertBusinessAccess(businessId);
  const business = await getBusinessById(businessId);
  return business ? { userId: session.userId, business } : null;
}

/** Owner-kontexten som EditorContext. */
export async function ownerEditorContext(): Promise<EditorContext | null> {
  const ctx = await ownerContext();
  return ctx ? { ...ctx, actor: "owner" } : null;
}

/**
 * Superadmin som redigerar en kunds meny eller produkter från /admin (R3-20).
 * businessId kommer från en bunden serveråtgärd på adminsidan — inte från ett
 * formulärfält — och rollen krävs här, så ett id utanför adminet ger inget.
 * Superadmin har åtkomst till alla sajter; det finns ingen tenant att gissa.
 */
export async function adminEditorContext(businessId: number): Promise<EditorContext | null> {
  const session = await requireRole("superadmin");
  if (!Number.isInteger(businessId) || businessId <= 0) return null;
  const business = await getBusinessById(businessId);
  return business ? { userId: session.userId, business, actor: "superadmin" } : null;
}
