import { describe, expect, it } from "vitest";
import { kept, keepSubmittedOnError, keptHours, keptServices } from "@/lib/kept-form";

describe("keepSubmittedOnError (R3-38)", () => {
  it("lägger det inskickade i state vid fel, inte vid ok, och skickar det aldrig vidare", async () => {
    const seen: unknown[] = [];
    type S = { error?: string; ok?: string };
    const action = keepSubmittedOnError(async (prev: S, fd: FormData): Promise<S> => {
      seen.push(prev);
      return fd.get("name") === "x" ? { error: "corto" } : { ok: "listo" };
    });
    const fd = new FormData();
    fd.set("name", "x");
    const failed = await action({}, fd);
    expect(failed.submitted).toBe(fd);
    const good = new FormData();
    good.set("name", "Panadería");
    const ok = await action(failed, good);
    expect(ok.submitted).toBeUndefined();
    expect(seen[1]).not.toHaveProperty("submitted");
  });
});

describe("kept-hjälparna", () => {
  it("kept faller tillbaka utan inskick och läser annars fältet", () => {
    const fd = new FormData();
    fd.set("city", "Luque");
    expect(kept(undefined, "city", "Asunción")).toBe("Asunción");
    expect(kept(fd, "city", "Asunción")).toBe("Luque");
    expect(kept(fd, "zone", "Centro")).toBe("Centro");
  });

  it("keptServices behåller tomma rader på sin plats", () => {
    const fd = new FormData();
    fd.set("service.0.name", "Pan");
    fd.set("service.2.name", "Tortas");
    expect(keptServices(fd, 3).map((s) => s.name)).toEqual(["Pan", "", "Tortas"]);
  });

  it("keptHours visar tiderna som de skrevs, stängd dag som null", () => {
    const fd = new FormData();
    fd.set("hours.mon.open", "08:00");
    fd.set("hours.mon.close", "12:00");
    fd.set("hours.mon.1.open", "15:00");
    fd.set("hours.mon.1.close", "19:00");
    fd.set("hours.sun.closed", "on");
    const hours = keptHours(fd, (d, s, e) => (s === 0 ? `hours.${d}.${e}` : `hours.${d}.1.${e}`));
    expect(hours.mon).toEqual([{ open: "08:00", close: "12:00" }, { open: "15:00", close: "19:00" }]);
    expect(hours.sun).toBeNull();
    expect(hours.tue).toBeNull();
  });
});
