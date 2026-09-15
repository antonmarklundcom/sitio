import { describe, expect, it } from "vitest";
import { parseAdminTheme } from "@/lib/admin-theme";

describe("parseAdminTheme", () => {
  it("accepts light", () => expect(parseAdminTheme("light")).toBe("light"));
  it("accepts dark", () => expect(parseAdminTheme("dark")).toBe("dark"));
  it("defaults to system for a missing cookie", () => expect(parseAdminTheme(undefined)).toBeNull());
  it.each(["garbage", "", "LIGHT", " dark"])("rejects invalid value %s", (value) => {
    expect(parseAdminTheme(value)).toBeNull();
  });
});
