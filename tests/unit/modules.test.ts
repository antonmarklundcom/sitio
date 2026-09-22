import { describe, expect, it } from "vitest";
import { MODULES, MODULE_KEYS, isModuleBuilt, moduleKeySchema, moduleMeta } from "@/lib/modules";

describe("modulregistret", () => {
  it("täcker varje nyckel i enumet exakt en gång", () => {
    expect(MODULES.map((m) => m.key).sort()).toEqual([...MODULE_KEYS].sort());
    expect(new Set(MODULES.map((m) => m.key)).size).toBe(MODULE_KEYS.length);
  });

  it("har etikett, sammanfattning och effekt för varje modul", () => {
    for (const m of MODULES) {
      expect(m.label).toBeTruthy();
      expect(m.summary).toBeTruthy();
      expect(m.effect).toBeTruthy();
    }
  });

  it("moduleMeta slår upp varje nyckel", () => {
    for (const key of MODULE_KEYS) expect(moduleMeta(key).key).toBe(key);
  });

  it("moduleMeta kastar på okänd nyckel", () => {
    // @ts-expect-error — avsiktligt fel nyckel, kontrollen är körtidens.
    expect(() => moduleMeta("nonexistent")).toThrow(/Okänd modulnyckel/);
  });

  it("isModuleBuilt följer plannedIn", () => {
    expect(isModuleBuilt("gallery")).toBe(true);
    expect(isModuleBuilt("menu")).toBe(true);
    expect(isModuleBuilt("extra_pages")).toBe(true);
    expect(isModuleBuilt("booking")).toBe(false);
  });

  it("zod-schemat släpper bara igenom kända nycklar", () => {
    expect(moduleKeySchema.safeParse("gallery").success).toBe(true);
    expect(moduleKeySchema.safeParse("galleri").success).toBe(false);
  });
});
