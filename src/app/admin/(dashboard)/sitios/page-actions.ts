"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { enabledModules } from "@/db/module-queries";
import { ownedPage } from "@/db/page-queries";
import { logActivity, requireRole } from "@/lib/auth";
import { PAGES_MAX, PAGE_TYPE_DEFAULTS, newPageSchema, pageContentSchema, pageSlugFor } from "@/lib/pages";

export type PageFormState = { error?: string; ok?: string };

/**
 * Sidor för extra_pages-modulen (R3-25, PR-18). Bara superadmin skapar,
 * tar bort, slår av/på och sorterar sidor; kunden redigerar titel och text i
 * /mi-sitio (PLAN.md: "owner får redigera innehåll, inte skapa/ta bort
 * sidor"). businessId binds på adminsidan; rollen krävs här.
 *
 * Modulen måste vara på för att skapa en sida. Stängs den av ligger sidorna
 * kvar orörda men svarar 404 — samma regel som menyn och produkterna.
 */
async function context(businessId: number) {
  const user = await requireRole("superadmin");
  const business = await getBusinessById(businessId);
  if (!business) return null;
  const modules = await enabledModules(businessId);
  return { user, business, moduleOn: modules.has("extra_pages") };
}

async function afterWrite(
  ctx: NonNullable<Awaited<ReturnType<typeof context>>>,
  action: string,
  meta: Record<string, unknown>,
) {
  await logActivity({ actorUserId: ctx.user.userId, businessId: ctx.business.id, action, meta });
  revalidateTag(`biz:${ctx.business.slug}`);
  revalidatePath(`/admin/sitios/${ctx.business.id}`);
  revalidatePath("/mi-sitio");
  revalidatePath("/sitemap.xml");
}

export async function createPageAction(
  businessId: number,
  _prev: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  const ctx = await context(businessId);
  if (!ctx) return { error: "El sitio no existe." };
  if (!ctx.moduleOn) return { error: "Activá el módulo extra_pages primero." };

  const parsed = newPageSchema.safeParse({
    type: formData.get("type") ?? "",
    title: formData.get("title") ?? "",
    pageSlug: formData.get("pageSlug") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const { type } = parsed.data;
  const title = parsed.data.title || PAGE_TYPE_DEFAULTS[type].title;
  if (title.length < 2) return { error: "Una página personalizada necesita un título." };

  const pageSlug = pageSlugFor(type, title, parsed.data.pageSlug);
  if (!pageSlug) return { error: "No pudimos armar la dirección de la página. Probá con otro título." };

  const existing = await db.select({ pageSlug: pages.pageSlug }).from(pages).where(eq(pages.businessId, businessId));
  if (existing.length >= PAGES_MAX) return { error: `Máximo ${PAGES_MAX} páginas por sitio.` };
  if (existing.some((p) => p.pageSlug === pageSlug)) return { error: `Ya hay una página /${pageSlug}.` };

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${pages.sortOrder}), -1) + 1` })
    .from(pages)
    .where(eq(pages.businessId, businessId));

  await db.insert(pages).values({
    businessId,
    pageSlug,
    type,
    title,
    contentJson: { body: "" },
    isEnabled: true,
    sortOrder: Number(next),
  });
  await afterWrite(ctx, "page_created", { pageSlug, type });
  return { ok: `Página /${pageSlug} creada. Escribí el texto abajo.` };
}

export async function updatePageAction(
  businessId: number,
  _prev: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  const ctx = await context(businessId);
  if (!ctx) return { error: "El sitio no existe." };
  const page = await ownedPage(businessId, Number(formData.get("pageId")));
  if (!page) return { error: "Esa página ya no existe." };

  const parsed = pageContentSchema.safeParse({ title: formData.get("title") ?? "", body: formData.get("body") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };

  const isEnabled = formData.get("isEnabled") === "on";
  await db
    .update(pages)
    .set({ title: parsed.data.title, contentJson: { body: parsed.data.body }, isEnabled })
    .where(eq(pages.id, page.id));
  await afterWrite(ctx, "page_updated", { pageId: page.id, isEnabled });
  return { ok: "Página guardada." };
}

export async function deletePageAction(businessId: number, formData: FormData): Promise<void> {
  const ctx = await context(businessId);
  if (!ctx) return;
  const page = await ownedPage(businessId, Number(formData.get("pageId")));
  if (!page) return;
  await db.delete(pages).where(and(eq(pages.id, page.id), eq(pages.businessId, businessId)));
  await afterWrite(ctx, "page_deleted", { pageId: page.id, pageSlug: page.pageSlug });
}

export async function movePageAction(businessId: number, formData: FormData): Promise<void> {
  const ctx = await context(businessId);
  if (!ctx) return;
  const pageId = Number(formData.get("pageId"));
  const step = String(formData.get("direction")) === "up" ? -1 : 1;
  if (!(await ownedPage(businessId, pageId))) return;

  const siblings = await db
    .select({ id: pages.id })
    .from(pages)
    .where(eq(pages.businessId, businessId))
    .orderBy(asc(pages.sortOrder), asc(pages.id));
  const index = siblings.findIndex((s) => s.id === pageId);
  const target = index + step;
  if (index < 0 || target < 0 || target >= siblings.length) return;

  // Hela ordningen skrivs om, samma skäl som för menyn och bilderna.
  const reordered = [...siblings];
  reordered[index] = siblings[target];
  reordered[target] = siblings[index];
  for (const [i, row] of reordered.entries()) {
    await db.update(pages).set({ sortOrder: i }).where(eq(pages.id, row.id));
  }
  await afterWrite(ctx, "page_moved", { pageId, direction: step });
}
