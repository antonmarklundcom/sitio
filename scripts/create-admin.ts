/**
 * Skapar (eller uppdaterar lösenordet för) en superadmin — inga demo-företag.
 * Avsett för produktion. Kör: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:admin
 * (tsx laddar inte .env själv — src/lib/env.ts gör det).
 */
import "../src/lib/env";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../src/lib/env";
import * as schema from "../src/db/schema";
import { users } from "../src/db/schema";

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";
const name = (process.env.ADMIN_NAME ?? "Anton").trim() || "Anton";

async function main() {
  if (!email.includes("@")) throw new Error("ADMIN_EMAIL saknas eller är ogiltig.");
  if (password.length < 10) throw new Error("ADMIN_PASSWORD måste vara minst 10 tecken.");

  const pool = mysql.createPool({ uri: env.databaseUrl, connectionLimit: 2, timezone: "Z" });
  const db = drizzle(pool, { schema, mode: "default" });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      await db.update(users).set({ passwordHash, role: "superadmin", status: "active" }).where(eq(users.id, existing.id));
      console.log(`✓ superadmin uppdaterad: ${email}`);
    } else {
      await db.insert(users).values({ role: "superadmin", name, email, passwordHash, status: "active" });
      console.log(`✓ superadmin skapad: ${email}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
