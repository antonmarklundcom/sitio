import { config as loadDotenv } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit laddar .env själv men INTE .env.local, som är filen README säger
// åt dig att skapa. Utan de här två raderna svarar `npm run db:migrate`
// "url: undefined" på en helt korrekt uppsatt utvecklingsmiljö.
loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });
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
