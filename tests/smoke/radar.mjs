/**
 * Rök för upsell-radarn (plan.md §6.3).
 *
 * Ingen browser här: testet skriver rakt i `analytics_daily` för två
 * engångssajter (mysql2, samma DATABASE_URL som appen), kör cron-routen med
 * bearer-hemligheten, och läser tillbaka `businesses.upsell_score` /
 * `hot_lead`. Städar sina egna rader oavsett utfall.
 *
 * Körs av tests/smoke/_run.mjs. Kräver samma .env.local som resten av
 * röksviten (se tests/smoke/README.md) — DATABASE_URL och CRON_SECRET läses
 * härifrån precis som src/lib/env.ts gör det för appen.
 */
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.local', quiet: true });
loadDotenv({ path: '.env', quiet: true });

import mysql from 'mysql2/promise';
import { B, createChecker } from './_lib.mjs';

const { ok, failed } = createChecker();
const CRON_SECRET = process.env.CRON_SECRET ?? '';
const stamp = Date.now();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function insertBusiness(slug, name) {
  const [res] = await conn.query(
    `insert into businesses (slug, name, category, whatsapp_phone, city, theme_key, status)
     values (?, ?, 'comercio', '+595981123456', 'Asunción', 'comercio', 'published')`,
    [slug, name],
  );
  return res.insertId;
}

async function insertDaily(businessId, day, views, waClicks) {
  await conn.query(
    `insert into analytics_daily (business_id, day, views, uniques, wa_clicks) values (?, ?, ?, ?, ?)`,
    [businessId, day, views, views, waClicks],
  );
}

const hotId = await insertBusiness(`radar-smoke-hot-${stamp}`, 'Radar Smoke Hot');
const coldId = await insertBusiness(`radar-smoke-cold-${stamp}`, 'Radar Smoke Cold');

try {
  const today = new Date().toISOString().slice(0, 10);
  // Klart över HOT_LEAD_WA_CLICKS_30D (default 15) mot klart under.
  await insertDaily(hotId, today, 50, 25);
  await insertDaily(coldId, today, 5, 1);

  const res = await fetch(`${B}/api/cron/rollup`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  ok('cron-routen svarar 200', res.status === 200, String(res.status));
  const body = await res.json().catch(() => ({}));
  ok('svaret har ett radar-resultat', typeof body.radar?.updated === 'number', JSON.stringify(body.radar));

  const [rows] = await conn.query(
    `select id, upsell_score, hot_lead from businesses where id in (?, ?) order by upsell_score desc`,
    [hotId, coldId],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const hot = byId.get(hotId);
  const cold = byId.get(coldId);

  ok('den aktiva sajten flaggas hot_lead', Boolean(hot?.hot_lead));
  ok('den svala sajten flaggas INTE hot_lead', cold && !cold.hot_lead);
  ok('den aktiva sajten får högre poäng', Boolean(hot && cold && hot.upsell_score > cold.upsell_score));
  ok('sorteringen (score desc) lägger den aktiva sajten först', rows[0]?.id === hotId);
} finally {
  await conn.query(`delete from analytics_daily where business_id in (?, ?)`, [hotId, coldId]);
  await conn.query(`delete from businesses where id in (?, ?)`, [hotId, coldId]);
  await conn.end();
}

console.log(failed() === 0 ? '\nAllt grönt.' : `\n${failed()} kontroll(er) föll.`);
process.exit(failed() === 0 ? 0 : 1);
