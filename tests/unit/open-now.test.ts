import { describe, expect, it } from "vitest";
import { OPEN_NOW_CORE } from "@/lib/open-now-script";

import { nowInAsuncion, openState, openingHoursSpecification, statusText } from "@/lib/hours";
import type { HoursMap } from "@/lib/business";

type Core = {
  sitioNow: (d: Date) => { dayKey: string; minutes: number };
  sitioOpenState: (h: HoursMap | null, dayKey: string, m: number) => unknown;
  sitioStatusText: (s: unknown) => string | null;
};
const core = new Function(`${OPEN_NOW_CORE}\nreturn { sitioNow, sitioOpenState, sitioStatusText };`)() as Core;

const HOURS: Record<string, HoursMap> = {
  siesta: {
    mon: [{ open: "08:00", close: "12:00" }, { open: "15:00", close: "19:00" }],
    tue: [{ open: "08:00", close: "12:00" }, { open: "15:00", close: "19:00" }],
    wed: null, thu: [{ open: "08:00", close: "18:00" }], fri: [{ open: "19:00", close: "00:00" }],
    sat: [{ open: "09:00", close: "13:00" }], sun: null,
  },
  dygnetRunt: Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, [{ open: "00:00", close: "00:00" }]])),
  barasöndag: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: [{ open: "10:00", close: "14:00" }] },
  allaStängda: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
};

describe("OpenNowScript (R3-35) följer openState/statusText", () => {
  // Var 37:e minut över en vecka, med start en måndag 00:00 i Asunción (03:00 UTC).
  const start = Date.UTC(2026, 8, 21, 3, 0);
  const times = Array.from({ length: Math.ceil((7 * 24 * 60) / 37) }, (_, i) => new Date(start + i * 37 * 60_000));

  for (const [name, hours] of Object.entries(HOURS)) {
    it(`samma text som servern: ${name}`, () => {
      for (const t of times) {
        const { dayKey, minutes } = core.sitioNow(t);
        expect({ dayKey, minutes }).toEqual(nowInAsuncion(t));
        expect(core.sitioStatusText(core.sitioOpenState(hours, dayKey, minutes))).toBe(statusText(openState(hours, t)));
      }
    });
  }

  it("inga öppettider ⇒ inget pill", () => {
    expect(core.sitioStatusText(core.sitioOpenState(null, "mon", 600))).toBeNull();
  });
});

describe("openingHoursSpecification dygnet runt (R3-35)", () => {
  it("00:00–00:00 blir 00:00–23:59, 19:00–00:00 lämnas", () => {
    const spec = openingHoursSpecification({ mon: [{ open: "00:00", close: "00:00" }], fri: [{ open: "19:00", close: "00:00" }] })!;
    expect(spec.find((s) => s.dayOfWeek === "Monday")?.closes).toBe("23:59");
    expect(spec.find((s) => s.dayOfWeek === "Friday")?.closes).toBe("00:00");
  });
});
