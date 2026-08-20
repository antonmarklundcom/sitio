import "server-only";
import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Poolen skapas lat, vid första faktiska frågan. Skapades den vid import
 * skulle `next build` kräva en giltig DATABASE_URL — bygget har inget med
 * databasen att göra, och pre-push-hooken har inga hemligheter.
 *
 * En Node-process på Hostinger delar poolen. connectionLimit hålls lågt:
 * MySQL-anslutningarna har ett tak som delas med allt annat på kontot.
 */
const globalForDb = globalThis as unknown as {
  __sitioPool?: mysql.Pool;
  __sitioDb?: MySql2Database<typeof schema>;
};

export function getPool(): mysql.Pool {
  if (!globalForDb.__sitioPool) {
    globalForDb.__sitioPool = mysql.createPool({
      uri: env.databaseUrl,
      connectionLimit: 8,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      timezone: "Z", // allt lagras i UTC; visning sker i America/Asuncion
    });
  }
  return globalForDb.__sitioPool;
}

function getDb(): MySql2Database<typeof schema> {
  if (!globalForDb.__sitioDb) {
    // DRIZZLE_LOG=1 loggar varje fråga till stdout. Ovärderligt när en
    // korrelerad subfråga ser rätt ut i koden men fel i utfallet.
    globalForDb.__sitioDb = drizzle(getPool(), {
      schema,
      mode: "default",
      logger: process.env.DRIZZLE_LOG === "1",
    });
  }
  return globalForDb.__sitioDb;
}

/**
 * Proxy så att anropsplatserna kan skriva `db.select()` rakt av utan att
 * bygget rör databasen förrän en fråga faktiskt körs.
 */
export const db = new Proxy({} as MySql2Database<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
