import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayKeyAsuncion } from "./analytics";
import { env } from "./env";

/**
 * Nattlig rollup av analytics_events → analytics_daily, plus prunning av
 * råeventen. Körs av /api/cron/rollup (hPanel-cron med CRON_SECRET) och som
 * lazy fallback vid första adminläsningen per dygn — Hostinger-cron är inte
 * garanterad, och statistiken är säljargumentet vid förnyelsen, så den får
 * inte tyst sluta uppdateras.
 *
 * Aggregatet är idempotent: samma dygn kan rullas upp hur många gånger som
 * helst (ON DUPLICATE KEY UPDATE skriver över raden, adderar aldrig).
 */

/** Råevent sparas 13 månader — ett år av jämförelsedata plus en månads marginal. */
const RAW_RETENTION_DAYS = 396;

/** Hur många dygn en full körning som mest går bakåt. */
const MAX_BACKFILL_DAYS = 60;

export type RollupResult = {
  days: string[];
  rowsWritten: number;
  eventsPruned: number;
};

/**
 * mysql2 returnerar [ResultSetHeader, fields]; drizzles execute skickar vidare
 * hela paret. Att läsa affectedRows direkt på resultatet ger tyst 0 — det såg
 * ut som att rollupen inte skrev något trots att raderna fanns i tabellen.
 */
function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dygnen som ska rullas upp, nyast sist. `days` räknas bakåt från idag. */
function dayRange(days: number): string[] {
  const today = new Date(`${dayKeyAsuncion()}T00:00:00Z`);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(isoDay(d));
  }
  return out;
}

/**
 * Aggregerar ett intervall av dygn. Bots exkluderas här — de lagras rått men
 * får aldrig synas i en kunds siffror.
 *
 * Dygnsgränsen ska följa Asunción, inte serverns. CONVERT_TZ med namngivna
 * zoner kräver att MySQL:s tz-tabeller är laddade, vilket de sällan är på delad
 * hosting — därför en ren timförskjutning i stället. Den förutsätter att
 * databasens klocka står på UTC; verifiera med `select now(), utc_timestamp()`
 * vid deploy-steg A och sätt annars ANALYTICS_TZ_OFFSET_HOURS.
 *
 * Paraguay avskaffade sommartid 2024 och ligger fast på UTC-3. Skulle det
 * ändras igen är det den här konstanten som ska ändras, inte SQL:en.
 */
async function aggregate(fromDay: string, toDay: string): Promise<number> {
  const shift = sql.raw(`interval ${env.analyticsTzOffsetHours} hour`);
  const result = await db.execute(sql`
    insert into analytics_daily
      (business_id, day, views, uniques, wa_clicks, phone_clicks, map_clicks, social_clicks)
    select
      e.business_id,
      date(e.created_at + ${shift}) as d,
      sum(e.type = 'page_view'),
      count(distinct case when e.type = 'page_view' then e.visitor_hash end),
      sum(e.type = 'whatsapp_click'),
      sum(e.type = 'phone_click'),
      sum(e.type = 'map_click'),
      sum(e.type = 'social_click')
    from analytics_events e
    where e.device_type <> 'bot'
      and e.created_at + ${shift} >= ${`${fromDay} 00:00:00`}
      and e.created_at + ${shift} < ${`${toDay} 00:00:00`} + interval 1 day
    group by e.business_id, d
    on duplicate key update
      views = values(views),
      uniques = values(uniques),
      wa_clicks = values(wa_clicks),
      phone_clicks = values(phone_clicks),
      map_clicks = values(map_clicks),
      social_clicks = values(social_clicks)
  `);

  return affectedRows(result);
}

async function prune(): Promise<number> {
  const result = await db.execute(sql`
    delete from analytics_events
    where created_at < utc_timestamp() - interval ${sql.raw(String(RAW_RETENTION_DAYS))} day
    limit 20000
  `);
  return affectedRows(result);
}

/** Full körning: används av cron-routen. */
export async function runRollup(days = MAX_BACKFILL_DAYS): Promise<RollupResult> {
  const range = dayRange(Math.min(Math.max(days, 1), MAX_BACKFILL_DAYS));
  const rowsWritten = await aggregate(range[0], range[range.length - 1]);
  const eventsPruned = await prune();
  return { days: [range[0], range[range.length - 1]], rowsWritten, eventsPruned };
}

/**
 * Lazy fallback. Rullar upp de senaste tre dygnen högst en gång per
 * processlivstid och dygn — så att adminets siffror stämmer även om cron-jobbet
 * aldrig sattes upp i hPanel, utan att varje sidladdning kostar en aggregering.
 *
 * Håller inte över flera processer (samma begränsning som rate-limiten), men
 * en dubbelkörning är ofarlig: aggregatet är idempotent.
 */
let lastLazyDay: string | null = null;
let inFlight: Promise<void> | null = null;

export async function ensureRollupFresh(): Promise<void> {
  const today = dayKeyAsuncion();
  if (lastLazyDay === today) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const range = dayRange(3);
      await aggregate(range[0], range[range.length - 1]);
      lastLazyDay = today;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
