import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";

export type MoveDirection = "up" | "down";

/**
 * Flyttar en bild ett steg inom sin egen kind. Delad av adminets
 * moveMediaAction och owner-panelens motsvarighet — båda behöver samma
 * garanti, och två kopior av den hade drivit isär.
 *
 * businessId kommer från anroparens tenant-kontroll och ligger i WHERE-satsen:
 * ett mediaId från ett annat business matchar ingenting och blir en no-op.
 *
 * Ordningen skrivs om i sin helhet i stället för att byta två sortOrder-värden.
 * Duplicerade värden är fullt möjliga (seed, import, tidigare buggar), och ett
 * värdebyte mellan två rader som redan har samma sortOrder flyttar ingenting.
 */
export async function moveMediaWithinKind(params: {
  businessId: number;
  mediaId: number;
  direction: MoveDirection;
}): Promise<boolean> {
  const step = params.direction === "up" ? -1 : 1;

  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, params.mediaId), eq(media.businessId, params.businessId)))
    .limit(1);
  if (!row) return false;

  const siblings = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.businessId, params.businessId), eq(media.kind, row.kind)))
    .orderBy(asc(media.sortOrder), asc(media.id));

  const index = siblings.findIndex((s) => s.id === params.mediaId);
  const targetIndex = index + step;
  if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return false;

  const reordered = [...siblings];
  reordered[index] = siblings[targetIndex];
  reordered[targetIndex] = siblings[index];

  for (const [i, item] of reordered.entries()) {
    await db.update(media).set({ sortOrder: i }).where(eq(media.id, item.id));
  }
  return true;
}
