import { vi } from "vitest";

/**
 * `import "server-only"` kastar utanför en Next-server. Modulerna vi testar är
 * rena funktioner i övrigt, så vakten stubbas bort i stället för att splittra
 * filerna.
 */
vi.mock("server-only", () => ({}));

// env.ts läser lazily, men de moduler som faktiskt hashar eller löser sökvägar
// behöver riktiga värden. Deterministiska testvärden, aldrig .env.local.
process.env.__SITIO_ENV_LOADED = "1";
process.env.SESSION_SECRET ??= "test-session-secret-that-is-long-enough-32";
process.env.UPLOADS_DIR ??= "/tmp/sitio-test-uploads";
process.env.CRON_SECRET ??= "test-cron-secret";
process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
