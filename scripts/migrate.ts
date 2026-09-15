import { readFileSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

function redact(value: string): string {
  let result = value.replace(/mysql:\/\/[^\s]+/gi, "[REDACTED DATABASE_URL]");
  for (const [key, secret] of Object.entries(process.env)) {
    if (secret && /PASSWORD|SECRET|TOKEN|KEY|DATABASE_URL/i.test(key)) {
      result = result.split(secret).join("[REDACTED]");
    }
  }
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const password = new URL(url).password;
      for (const secret of [password, decodeURIComponent(password)]) {
        if (secret) result = result.split(secret).join("[REDACTED]");
      }
    } catch { /* Invalid URLs are reported without exposing credentials. */ }
  }
  return result;
}

async function main() {
  loadDotenv({ path: ".env.local", quiet: true });
  loadDotenv({ path: ".env", quiet: true });
  if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
  const journal = JSON.parse(readFileSync("./drizzle/meta/_journal.json", "utf8")) as {
    entries: { tag: string; when: number }[];
  };
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    let lastApplied = -Infinity;
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
      );
      if (rows.length) lastApplied = Number(rows[0].created_at);
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw error;
    }
    await migrate(drizzle(connection), { migrationsFolder: "./drizzle" });
    const applied = journal.entries.filter((entry) => entry.when > lastApplied);
    for (const entry of applied) console.log(`Applied migration: ${entry.tag}`);
    if (!applied.length) console.log("No pending migrations.");
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  const seen = new Set<unknown>();
  let current = error;
  let printedSql = false;
  while (current && !seen.has(current)) {
    seen.add(current);
    const detail = current as { message?: string; sql?: string; query?: string; cause?: unknown };
    console.error(redact(detail.message ?? String(current)));
    const sql = detail.sql ?? detail.query;
    if (sql) {
      console.error(`SQL: ${redact(sql)}`);
      printedSql = true;
    }
    current = detail.cause;
  }
  if (!printedSql) console.error("SQL: unavailable (failure before a statement was reported)");
  process.exit(1);
});
