import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext (R3-42)", () => {
  it("släpper igenom relativa sökvägar i rätt yta, med query", () => {
    expect(safeNext("/admin/sitios/4", "admin", "/admin")).toBe("/admin/sitios/4");
    expect(safeNext("/admin/pagos?estado=reported", "admin", "/admin")).toBe("/admin/pagos?estado=reported");
    expect(safeNext("/mi-sitio", "owner", "/mi-sitio")).toBe("/mi-sitio");
  });

  it("nekar allt som kan lämna sajten", () => {
    for (const bad of [
      "//evil.com",
      "//evil.com/admin",
      "/\\evil.com",
      "\\\\evil.com",
      "https://evil.com/admin",
      "http:/admin",
      "javascript:alert(1)",
      "admin/sitios",
      "/admin\n/x",
      "/admin\t",
      "/%2F%2Fevil.com",
    ]) {
      const out = safeNext(bad, "admin", "/admin");
      expect(out.startsWith("//")).toBe(false);
      expect(out === "/admin" || out.startsWith("/admin/")).toBe(true);
    }
    expect(safeNext("//evil.com", "admin", "/admin")).toBe("/admin");
    expect(safeNext("/\\evil.com", "admin", "/admin")).toBe("/admin");
    expect(safeNext("https://evil.com/admin", "admin", "/admin")).toBe("/admin");
  });

  it("nekar en annan yta, en kundsajt och tomt", () => {
    expect(safeNext("/mi-sitio", "admin", "/admin")).toBe("/admin");
    expect(safeNext("/admin", "owner", "/mi-sitio")).toBe("/mi-sitio");
    expect(safeNext("/administradora-lopez", "admin", "/admin")).toBe("/admin");
    expect(safeNext("/admin/../pizzeria", "admin", "/admin")).toBe("/admin");
    expect(safeNext(undefined, "admin", "/admin")).toBe("/admin");
    expect(safeNext(null, "owner", "")).toBe("");
    expect(safeNext("/admin/" + "x".repeat(400), "admin", "/admin")).toBe("/admin");
  });
});
