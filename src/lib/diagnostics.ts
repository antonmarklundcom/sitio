import "server-only";
import { randomBytes } from "node:crypto";
import { stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/db";
import { env } from "./env";

/**
 * /admin/diagnostico (R3-26): det som bara går att mäta på Hostinger.
 * Allt här läses, ingenting ändras — utom en tempfil i uploads som skrivs och
 * tas bort direkt för att bevisa att katalogen är skrivbar.
 */

/** Proxyheaders som avgör vilken hop rate limits ska nycklas på (R3-27). */
export const DIAG_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "forwarded",
  "cf-connecting-ip",
  "host",
  "x-forwarded-proto",
] as const;

export function pickHeaders(headers: Headers): { name: string; value: string | null }[] {
  return DIAG_HEADERS.map((name) => ({ name, value: headers.get(name) }));
}

/**
 * Env-variabler som bara visas som finns/saknas. ALDRIG värdet — sidan är
 * superadmin-only, men en skärmdump eller en delad skärm ska inte läcka nycklar.
 * NEXT_PUBLIC_SALES_WHATSAPP läses så som bygget bakade in den.
 */
export const DIAG_ENV = [
  "RESEND_API_KEY",
  "RESEND_FROM",
  "NEXT_PUBLIC_SALES_WHATSAPP",
  "VENDERCRM_URL",
  "VENDERCRM_API_KEY",
  "ANTHROPIC_API_KEY",
  "CRON_SECRET",
] as const;

export function envPresence(source: Record<string, string | undefined>): { name: string; set: boolean }[] {
  return DIAG_ENV.map((name) => {
    // Next ersätter process.env.NEXT_PUBLIC_* vid bygget; en dynamisk nyckel
    // gör det inte, så den läses explicit för att visa det inbakade värdet.
    const value = name === "NEXT_PUBLIC_SALES_WHATSAPP" ? env.salesWhatsapp : source[name];
    return { name, set: typeof value === "string" && value.trim().length > 0 };
  });
}

export type DbClock = {
  version: string;
  now: string;
  utcNow: string;
  timeZone: string;
  systemTimeZone: string;
  /** now() − utc_timestamp() i hela timmar; 0 = databasen står på UTC. */
  offsetHours: number;
};

export async function dbClock(): Promise<DbClock | { error: string }> {
  try {
    // dateStrings: rå text från servern, inte tolkad genom poolens timezone "Z".
    const [rows] = await getPool().query<RowDataPacket[]>({
      sql: "select version() as v, now() as n, utc_timestamp() as u, @@time_zone as tz, @@system_time_zone as stz, timestampdiff(minute, utc_timestamp(), now()) as diff",
      dateStrings: true,
    });
    const r = rows[0];
    return {
      version: String(r.v),
      now: String(r.n),
      utcNow: String(r.u),
      timeZone: String(r.tz),
      systemTimeZone: String(r.stz),
      offsetHours: Math.round(Number(r.diff) / 60),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export type UploadsCheck = {
  dir: string;
  cwd: string;
  exists: boolean;
  writable: boolean;
  /** true när UPLOADS_DIR ligger i appkatalogen — git-deployen skriver om den. */
  insideApp: boolean;
  error?: string;
};

export async function checkUploads(): Promise<UploadsCheck> {
  const cwd = process.cwd();
  let dir: string;
  try {
    dir = path.resolve(env.uploadsDir);
  } catch (err) {
    return { dir: "", cwd, exists: false, writable: false, insideApp: false, error: err instanceof Error ? err.message : String(err) };
  }
  const insideApp = dir === cwd || dir.startsWith(cwd + path.sep);

  try {
    if (!(await stat(dir)).isDirectory()) return { dir, cwd, exists: false, writable: false, insideApp, error: "no es un directorio" };
  } catch {
    return { dir, cwd, exists: false, writable: false, insideApp };
  }

  const probe = path.join(dir, `.diag-${randomBytes(6).toString("hex")}`);
  try {
    await writeFile(probe, "ok");
    await unlink(probe);
    return { dir, cwd, exists: true, writable: true, insideApp };
  } catch (err) {
    return { dir, cwd, exists: true, writable: false, insideApp, error: err instanceof Error ? err.message : String(err) };
  }
}
