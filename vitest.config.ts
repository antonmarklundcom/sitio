import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Enhetstester för ren logik (plan.md §5.1). Inget här rör databasen —
 * allt som behöver `db` är smoke-territorium (tests/smoke/).
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/unit/setup.ts"],
  },
});
