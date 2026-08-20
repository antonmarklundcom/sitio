/**
 * Central env-åtkomst. Läser .env explicit när koden körs utanför Next
 * (tsx-scripts laddar inte .env själv — se docs/RUNNER-POLICY.md och README).
 */
import { config as loadDotenv } from "dotenv";

if (!process.env.NEXT_RUNTIME && !process.env.__SITIO_ENV_LOADED) {
  loadDotenv({ path: ".env.local", quiet: true });
  loadDotenv({ path: ".env", quiet: true });
  process.env.__SITIO_ENV_LOADED = "1";
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Saknad miljövariabel: ${name}`);
  return v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get sessionSecret() {
    const s = required("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET måste vara minst 32 tecken.");
    return s;
  },
  get cronSecret() {
    return required("CRON_SECRET");
  },
  get uploadsDir() {
    return required("UPLOADS_DIR");
  },
  get anthropicApiKey() {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get hotLeadWaClicks30d() {
    return int("HOT_LEAD_WA_CLICKS_30D", 15);
  },
  get hotLeadViews30d() {
    return int("HOT_LEAD_VIEWS_30D", 300);
  },
};

/**
 * Bas-URL utan avslutande slash. ENDA källan till absoluta URL:er i appen.
 * Hårdkoda aldrig en domän någon annanstans — domänbytet ska vara en env-ändring.
 */
export function baseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Absolut URL för en app-intern sökväg. */
export function absoluteUrl(path = "/"): string {
  return `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
