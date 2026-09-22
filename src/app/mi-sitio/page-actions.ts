"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { enabledModules } from "@/db/module-queries";
import { ownedPage } from "@/db/page-queries";
import { logActivity } from "@/lib/auth";
import { ownerContext } from "@/lib/owner-context";
import { pageContentSchema } from "@/lib/pages";

export type OwnerPageState = { error?: string; ok?: string };

/**
 * Kunden redigerar titel och text på en av sina extra sidor (R3-25). Skapa,
 * ta bort, slå av/på och sortera gör superadmin — sidstrukturen är en del av
 * det vi säljer, texten är kundens. Tenant ur sessionen, modulen måste vara på
 * och sidan måste tillhöra tenanten.
 */
export async function savePageContentAction(_prev: OwnerPageState, formData: FormData): Promise<OwnerPageState> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "No pudimos guardar. Entrá de nuevo." };
  if (!(await enabledModules(ctx.business.id)).has("extra_pages")) {
    return { error: "No pudimos guardar. Entrá de nuevo." };
  }

  const page = await ownedPage(ctx.business.id, Number(formData.get("pageId")));
  if (!page) return { error: "Esa página ya no existe." };

  const parsed = pageContentSchema.safeParse({ title: formData.get("title") ?? "", body: formData.get("body") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá el texto." };

  await db
    .update(pages)
    .set({ title: parsed.data.title, contentJson: { body: parsed.data.body } })
    .where(eq(pages.id, page.id));

  await logActivity({
    actorUserId: ctx.userId,
    businessId: ctx.business.id,
    action: "owner_page_updated",
    meta: { pageId: page.id },
  });
  revalidateTag(`biz:${ctx.business.slug}`);
  revalidatePath("/mi-sitio");
  revalidatePath(`/admin/sitios/${ctx.business.id}`);
  return { ok: "¡Guardado! Ya se ve en tu página." };
}
