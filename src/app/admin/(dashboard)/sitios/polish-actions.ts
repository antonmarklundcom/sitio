"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, businesses } from "@/db/schema";
import { getBusinessById } from "@/db/queries";
import { logActivity, requireRole } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  POLISH_FIELDS,
  polishBusiness,
  polishResponseSchema,
  polishUsageSchema,
  type PolishFieldKey,
  type PolishResult,
  type PolishUsage,
} from "@/lib/ai-polish";

export type PolishState = { error?: string; ok?: string; warnings?: string[] };

/** Superadmin får köra tio putsningar i timmen. Per process, som allt annat. */
const POLISH_LIMIT = 10;
const POLISH_WINDOW_MS = 60 * 60 * 1000;

export type StoredProposal = {
  result: PolishResult;
  warnings: string[];
  usage: PolishUsage;
  proposedAt: string;
};

/**
 * Förslaget lagras som `ai_polish_proposed` i activity_log i stället för i ett
 * eget tillstånd. Skälet är enkelt: en omladdning av sidan får inte slänga ett
 * anrop du redan betalat för, och loggen fanns redan.
 */
async function loadProposal(businessId: number): Promise<StoredProposal | null> {
  const [row] = await db
    .select({ meta: activityLog.metaJson, createdAt: activityLog.createdAt })
    .from(activityLog)
    .where(and(eq(activityLog.businessId, businessId), eq(activityLog.action, "ai_polish_proposed")))
    .orderBy(desc(activityLog.id))
    .limit(1);

  if (!row?.meta || typeof row.meta !== "object") return null;
  const meta = row.meta as Record<string, unknown>;
  const parsed = polishResponseSchema.safeParse(meta.result);
  if (!parsed.success) return null;

  const usage = polishUsageSchema.safeParse(meta.usage);

  return {
    result: parsed.data,
    warnings: Array.isArray(meta.warnings) ? meta.warnings.map(String) : [],
    // En handredigerad eller äldre rad får inte rendera "undefined tokens".
    usage: usage.success ? usage.data : { model: "desconocido", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
    proposedAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
  };
}

/** Läses av sidan när den renderas — inget API-anrop, bara den sparade raden. */
export async function getPolishProposal(businessId: number): Promise<StoredProposal | null> {
  await requireRole("superadmin");
  return loadProposal(businessId);
}

/**
 * Kör putsningen. Skriver ingenting i `businesses` — förslaget granskas först
 * (docs/PLAN.md D7).
 */
export async function runPolishAction(
  businessId: number,
  _prev: PolishState,
  _formData: FormData,
): Promise<PolishState> {
  const user = await requireRole("superadmin");

  const business = await getBusinessById(businessId);
  if (!business) return { error: "El sitio no existe." };

  const limit = rateLimit(`ai-polish:${user.userId}`, POLISH_LIMIT, POLISH_WINDOW_MS);
  if (!limit.ok) {
    return { error: `Demasiadas mejoras. Probá de nuevo en ${Math.ceil(limit.retryAfterMs / 60000)} minutos.` };
  }

  const outcome = await polishBusiness(business);
  if (!outcome.ok) return { error: outcome.error };

  await logActivity({
    actorUserId: user.userId,
    businessId,
    action: "ai_polish_proposed",
    meta: { result: outcome.result, warnings: outcome.warnings, usage: outcome.usage },
  });

  revalidatePath(`/admin/sitios/${businessId}`);
  return { ok: "La propuesta está lista. Revisá y elegí qué campos querés guardar.", warnings: outcome.warnings };
}

/**
 * Skriver de ikryssade fälten. `rawDescription` rörs aldrig: kundens egen röst
 * är originalet och måste gå att putsa om.
 */
export async function applyPolishAction(
  businessId: number,
  _prev: PolishState,
  formData: FormData,
): Promise<PolishState> {
  const user = await requireRole("superadmin");

  const business = await getBusinessById(businessId);
  if (!business) return { error: "El sitio no existe." };

  const proposal = await loadProposal(businessId);
  if (!proposal) return { error: "No hay una propuesta para aplicar. Ejecutá la mejora primero." };

  const selected = formData
    .getAll("field")
    .map(String)
    .filter((f): f is PolishFieldKey => (POLISH_FIELDS as readonly string[]).includes(f));

  if (selected.length === 0) return { error: "No seleccionaste ningún campo." };

  const patch: Partial<typeof businesses.$inferInsert> = { aiPolishedAt: new Date() };
  if (selected.includes("description")) patch.description = proposal.result.description;
  if (selected.includes("seoTitle")) patch.seoTitle = proposal.result.seoTitle;
  if (selected.includes("seoDescription")) patch.seoDescription = proposal.result.seoDescription;
  if (selected.includes("services")) patch.servicesJson = proposal.result.services;

  await db.update(businesses).set(patch).where(eq(businesses.id, businessId));

  await logActivity({
    actorUserId: user.userId,
    businessId,
    action: "ai_polish_applied",
    meta: { fields: selected, model: proposal.usage.model },
  });

  revalidateTag(`biz:${business.slug}`);
  revalidatePath(`/admin/sitios/${businessId}`);
  revalidatePath("/admin");

  return { ok: `${selected.length} campos guardados y el sitio está marcado como mejorado.` };
}
