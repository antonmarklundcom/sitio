import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MariaDB schema compatibility", () => {
  it.each(["drizzle/0000_violet_squadron_supreme.sql", "src/db/schema.ts"])(
    "%s avoids the incompatible column token",
    (path) => {
      expect(readFileSync(path, "utf8")).not.toMatch(/\bserial\b/i);
    },
  );

  it("preserves the applied migration timestamp", () => {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    expect(journal.entries.find((entry: { idx: number }) => entry.idx === 0)?.when)
      .toBe(1787239954719);
  });
});
