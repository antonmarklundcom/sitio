import type { Config } from "drizzle-kit";

// drizzle-kit laddar .env själv. tsx gör det INTE — scripts/*.ts läser via src/lib/env.ts.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
