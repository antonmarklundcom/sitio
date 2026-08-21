import "server-only";
import { getBusinessById } from "@/db/queries";
import { assertBusinessAccess, requireRole } from "@/lib/auth";
import { currentUser } from "@/lib/session";
import type { Business } from "@/db/schema";

export type OwnerContext = { userId: number; business: Business };

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
