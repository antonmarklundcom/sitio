import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, like, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "./index";
import { analyticsEvents, siteLeads, type Business, type SiteLead } from "./schema";
import { getBusinessById } from "./queries";
import { assertBusinessAccess } from "@/lib/auth";
import { currentUser } from "@/lib/session";
import { REF_WINDOW_DAYS, TAB_STATUSES, escapeLike, monthStart, type CrmTab, type LeadSearch } from "@/lib/crm";

/**
 * Läsningar för ägarens CRM (crm-1). Varje fråga tar businessId från anroparen,
 * som i sin tur har det ur SESSIONEN (ownerContext / resolveCrmScope) — aldrig
 * ur ett formulär eller en URL (utom superadmins ?sitio=, som bara läser).
 */

export type CrmScope = { business: Business; readOnly: boolean };

/**
 * Vilken sajt CRM-vyn visar: ägarens egen, eller för superadmin den som pekas ut
 * med ?sitio=<id> (skrivskyddad, som /mi-sitio). Samma regler som sidan där.
 * Returnerar null när det inte finns någon sajt att visa — anroparen
 * bestämmer om det blir en redirect eller ett 4xx.
 */
export async function resolveCrmScope(sitio?: string | null): Promise<CrmScope | null> {
  const user = await currentUser();
  if (!user?.userId) return null;
  let businessId: number | undefined;
  if (user.role === "owner") businessId = user.businessId ?? undefined;
  else if (user.role === "superadmin") businessId = Number(sitio);
  else return null;
  if (!businessId || !Number.isInteger(businessId) || businessId <= 0) return null;
  await assertBusinessAccess(businessId);
  const business = await getBusinessById(businessId);
  return business ? { business, readOnly: user.role !== "owner" } : null;
}

const RESOLVED_STATUSES = ["cliente", "perdido", "cerrado"] as const;

/** Uppföljning idag eller tidigare på en olöst lead. Datum jämförs som sträng: kolumnen är DATE. */
function dueWhere(businessId: number, today: string): SQL | undefined {
  return and(
    eq(siteLeads.businessId, businessId),
    isNotNull(siteLeads.followUpDay),
    sql`${siteLeads.followUpDay} <= ${today}`,
    notInArray(siteLeads.status, [...RESOLVED_STATUSES]),
  );
}

export async function listDueLeads(businessId: number, today: string, limit = 100): Promise<SiteLead[]> {
  return db
    .select()
    .from(siteLeads)
    .where(dueWhere(businessId, today))
    .orderBy(siteLeads.followUpDay, siteLeads.id)
    .limit(limit);
}

export async function countDueLeads(businessId: number, today: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(siteLeads).where(dueWhere(businessId, today));
  return Number(row?.n ?? 0);
}

/** Antal per status — en grupperad fråga för flikarna. */
export async function leadCountsByStatus(businessId: number): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: siteLeads.status, n: count() })
    .from(siteLeads)
    .where(eq(siteLeads.businessId, businessId))
    .groupBy(siteLeads.status);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

function listWhere(businessId: number, tab: CrmTab, search: LeadSearch): SQL | undefined {
  const statuses = TAB_STATUSES[tab];
  const searchConds: SQL[] = [];
  if (search.text) searchConds.push(like(siteLeads.name, `%${escapeLike(search.text)}%`));
  if (search.phone) searchConds.push(eq(siteLeads.phone, search.phone));
  if (search.phoneDigits) searchConds.push(like(siteLeads.phone, `%${escapeLike(search.phoneDigits)}%`));
  return and(
    eq(siteLeads.businessId, businessId),
    statuses ? inArray(siteLeads.status, [...statuses]) : undefined,
    searchConds.length > 0 ? or(...searchConds) : undefined,
  );
}

export async function listLeads(
  businessId: number,
  opts: { tab: CrmTab; search: LeadSearch; page: number; pageSize: number },
): Promise<{ rows: SiteLead[]; total: number }> {
  const where = listWhere(businessId, opts.tab, opts.search);
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(siteLeads)
      .where(where)
      .orderBy(desc(siteLeads.createdAt), desc(siteLeads.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ n: count() }).from(siteLeads).where(where),
  ]);
  return { rows, total: Number(totalRow?.n ?? 0) };
}

/** Hur många gånger varje nummer finns hos den här sajten — en grupperad fråga, inte en per rad. */
export async function repeatCounts(businessId: number, phones: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(phones)];
  const out = new Map<string, number>();
  if (unique.length === 0) return out;
  const rows = await db
    .select({ phone: siteLeads.phone, n: count() })
    .from(siteLeads)
    .where(and(eq(siteLeads.businessId, businessId), inArray(siteLeads.phone, unique)))
    .groupBy(siteLeads.phone);
  for (const r of rows) out.set(r.phone, Number(r.n));
  return out;
}

/**
 * Månadens siffror, i en fråga. "Clientes" och beloppet gäller leads som
 * skapades denna månad (det finns ingen egen tidpunkt för när en lead blev
 * kund). `today` är Asunción-dagen.
 */
export async function monthStats(
  businessId: number,
  today: string,
): Promise<{ leads: number; clientes: number; valueGs: number }> {
  const [row] = await db
    .select({
      leads: count(),
      clientes: sql<string | null>`SUM(CASE WHEN ${siteLeads.status} = 'cliente' THEN 1 ELSE 0 END)`,
      valueGs: sql<string | null>`SUM(CASE WHEN ${siteLeads.status} = 'cliente' THEN COALESCE(${siteLeads.valueGs}, 0) ELSE 0 END)`,
    })
    .from(siteLeads)
    .where(and(eq(siteLeads.businessId, businessId), sql`${siteLeads.createdAt} >= ${monthStart(today)}`));
  return { leads: Number(row?.leads ?? 0), clientes: Number(row?.clientes ?? 0), valueGs: Number(row?.valueGs ?? 0) };
}

export async function getLeadFor(businessId: number, leadId: number): Promise<SiteLead | null> {
  const [row] = await db
    .select()
    .from(siteLeads)
    .where(and(eq(siteLeads.id, leadId), eq(siteLeads.businessId, businessId)))
    .limit(1);
  return row ?? null;
}

/** Senaste WhatsApp-klicket med koden hos DEN HÄR sajten de senaste 60 dagarna. */
export async function findRefClick(
  businessId: number,
  code: string,
  now: Date = new Date(),
): Promise<{ path: string | null; referrerHost: string | null } | null> {
  const since = new Date(now.getTime() - REF_WINDOW_DAYS * 86_400_000);
  const [row] = await db
    .select({ path: analyticsEvents.path, referrerHost: analyticsEvents.referrerHost })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.businessId, businessId),
        eq(analyticsEvents.type, "whatsapp_click"),
        eq(analyticsEvents.refCode, code),
        gte(analyticsEvents.createdAt, since),
      ),
    )
    .orderBy(desc(analyticsEvents.createdAt), desc(analyticsEvents.id))
    .limit(1);
  return row ?? null;
}

export async function refCodeAlreadyRegistered(businessId: number, code: string): Promise<boolean> {
  const [row] = await db
    .select({ id: siteLeads.id })
    .from(siteLeads)
    .where(and(eq(siteLeads.businessId, businessId), eq(siteLeads.refCode, code)))
    .limit(1);
  return Boolean(row);
}

/** Kortet på /mi-sitio: antal nya, "para hoy" och de tre senaste. */
export async function inboxSummary(
  businessId: number,
  today: string,
): Promise<{ fresh: number; due: number; total: number; latest: SiteLead[] }> {
  const [counts, due, latest] = await Promise.all([
    leadCountsByStatus(businessId),
    countDueLeads(businessId, today),
    db
      .select()
      .from(siteLeads)
      .where(eq(siteLeads.businessId, businessId))
      .orderBy(desc(siteLeads.createdAt), desc(siteLeads.id))
      .limit(3),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { fresh: counts.nuevo ?? 0, due, total, latest };
}

/** Allt för CSV-exporten, med ett tak så att en enda nedladdning aldrig blir oändlig. */
export async function exportLeads(businessId: number, limit = 5000): Promise<SiteLead[]> {
  return db
    .select()
    .from(siteLeads)
    .where(eq(siteLeads.businessId, businessId))
    .orderBy(desc(siteLeads.createdAt), desc(siteLeads.id))
    .limit(limit);
}
