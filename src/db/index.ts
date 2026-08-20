import "server-only";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { env } from "@/lib/env";
import * as schema from "./schema";

// En Node-process på Hostinger delar poolen. connectionLimit hålls lågt:
// Hostingers MySQL har en anslutningscap som delas med allt annat på kontot.
const globalForDb = globalThis as unknown as {
  __sitioPool?: mysql.Pool;
};

function createPool(): mysql.Pool {
  return mysql.createPool({
    uri: env.databaseUrl,
    connectionLimit: 8,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    timezone: "Z", // allt lagras i UTC; visning sker i America/Asuncion
  });
}

export const pool: mysql.Pool = globalForDb.__sitioPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__sitioPool = pool;

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
