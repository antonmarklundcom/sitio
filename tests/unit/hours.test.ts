import { describe, expect, it } from "vitest";
import {
  DAY_LABELS_ES,
  groupedHours,
  normalizeIntervals,
  nowInAsuncion,
  openState,
  openingHoursSpecification,
} from "@/lib/hours";
import type { HoursMap } from "@/lib/business";

/** Asunción ligger fast på UTC-3 (ingen sommartid sedan 2024). */
const at = (iso: string) => new Date(iso);

describe("nowInAsuncion", () => {
  it("skiftar tre timmar bakåt från UTC", () => {
    const { dayKey, minutes } = nowInAsuncion(at("2026-03-11T15:30:00Z"));
    expect(dayKey).toBe("wed");
    expect(minutes).toBe(12 * 60 + 30);
  });

  it("hamnar på föregående dygn när UTC redan bytt dag", () => {
    const { dayKey, minutes } = nowInAsuncion(at("2026-03-12T01:00:00Z"));
    expect(dayKey).toBe("wed");
    expect(minutes).toBe(22 * 60);
  });

  it("hanterar midnatt i Asunción som minut 0", () => {
    expect(nowInAsuncion(at("2026-03-12T03:00:00Z")).minutes).toBe(0);
    expect(nowInAsuncion(at("2026-03-12T03:00:00Z")).dayKey).toBe("thu");
  });
});

describe("openState", () => {
  const weekday: HoursMap = {
    mon: [{ open: "08:00", close: "12:00" }, { open: "14:00", close: "18:00" }],
    tue: null,
    wed: [{ open: "08:00", close: "18:00" }],
    thu: null,
    fri: null,
    sat: null,
    sun: null,
  };

  it("returnerar null utan öppettider", () => {
    expect(openState(null)).toBeNull();
    expect(openState(undefined)).toBeNull();
    expect(openState({})).toBeNull();
  });

  it("är öppet mitt i ett intervall och rapporterar stängningstiden", () => {
    // onsdag 12:00 Asunción
    const state = openState(weekday, at("2026-03-11T15:00:00Z"));
    expect(state).toEqual({ open: true, closesAt: "18:00" });
  });

  it("är stängt exakt på stängningsminuten", () => {
    // onsdag 18:00 Asunción
    expect(openState(weekday, at("2026-03-11T21:00:00Z"))?.open).toBe(false);
  });

  it("hittar nästa pass samma dag vid siesta", () => {
    // måndag 13:00 Asunción, mellan passen
    const state = openState(weekday, at("2026-03-09T16:00:00Z"));
    expect(state).toEqual({ open: false, opensAt: "14:00", opensDay: null });
  });

  it("är öppet i det andra passet efter siestan", () => {
    // måndag 15:00 Asunción
    expect(openState(weekday, at("2026-03-09T18:00:00Z"))).toEqual({ open: true, closesAt: "18:00" });
  });

  it("hoppar över stängda dagar och namnger nästa öppna dag på spanska", () => {
    // onsdag 19:00 Asunción, nästa öppna dag är måndag
    const state = openState(weekday, at("2026-03-11T22:00:00Z"));
    expect(state).toEqual({ open: false, opensAt: "08:00", opensDay: "Lunes" });
  });

  it("tolkar 00:00 som midnatt i slutet av dygnet", () => {
    const nightly: HoursMap = { wed: [{ open: "19:00", close: "00:00" }] };
    // onsdag 23:30 Asunción
    expect(openState(nightly, at("2026-03-12T02:30:00Z"))).toEqual({ open: true, closesAt: "00:00" });
  });

  it("är öppet på öppningsminuten men inte minuten före", () => {
    // onsdag 08:00 respektive 07:59 Asunción
    expect(openState(weekday, at("2026-03-11T11:00:00Z"))?.open).toBe(true);
    expect(openState(weekday, at("2026-03-11T10:59:00Z"))?.open).toBe(false);
  });
});

describe("groupedHours", () => {
  it("slår ihop intilliggande dagar med samma tider", () => {
    const rows = groupedHours({
      mon: [{ open: "08:00", close: "17:00" }],
      tue: [{ open: "08:00", close: "17:00" }],
      wed: [{ open: "08:00", close: "17:00" }],
      thu: null,
      fri: null,
      sat: null,
      sun: null,
    });
    expect(rows[0]).toEqual({ days: "Lunes – Miércoles", intervals: [{ open: "08:00", close: "17:00" }] });
    expect(rows[1].intervals).toBeNull();
    expect(rows).toHaveLength(2);
  });

  it("ger tom lista utan öppettider", () => {
    expect(groupedHours(null)).toEqual([]);
  });
});

describe("openingHoursSpecification", () => {
  it("blir undefined när inget är öppet", () => {
    expect(openingHoursSpecification(null)).toBeUndefined();
    expect(openingHoursSpecification({ mon: null })).toBeUndefined();
  });

  it("ger en post per intervall med schema.org-dagnamn", () => {
    const spec = openingHoursSpecification({ mon: [{ open: "08:00", close: "12:00" }, { open: "14:00", close: "18:00" }] });
    expect(spec).toHaveLength(2);
    expect(spec?.[0].dayOfWeek).toBe("Monday");
    expect(spec?.[1].opens).toBe("14:00");
  });
});

describe("DAY_LABELS_ES", () => {
  it("täcker alla sju dagsnycklar", () => {
    expect(Object.keys(DAY_LABELS_ES)).toHaveLength(7);
  });
});

describe("normalizeIntervals (R3-19)", () => {
  it("behåller två pass med siesta emellan, sorterade", () => {
    expect(
      normalizeIntervals([
        { open: "15:00", close: "19:00" },
        { open: "08:00", close: "12:00" },
      ]),
    ).toEqual([
      { open: "08:00", close: "12:00" },
      { open: "15:00", close: "19:00" },
    ]);
  });

  it("slår ihop pass som överlappar eller möts", () => {
    expect(
      normalizeIntervals([
        { open: "08:00", close: "17:00" },
        { open: "14:00", close: "19:00" },
      ]),
    ).toEqual([{ open: "08:00", close: "19:00" }]);
    expect(
      normalizeIntervals([
        { open: "08:00", close: "12:00" },
        { open: "12:00", close: "16:00" },
      ]),
    ).toEqual([{ open: "08:00", close: "16:00" }]);
  });

  it("godtar midnatt som stängning", () => {
    expect(
      normalizeIntervals([
        { open: "11:00", close: "15:00" },
        { open: "19:00", close: "00:00" },
      ]),
    ).toEqual([
      { open: "11:00", close: "15:00" },
      { open: "19:00", close: "00:00" },
    ]);
  });

  it("kastar tomma, felformade och bakvända pass", () => {
    expect(normalizeIntervals([{ open: "", close: "" }])).toEqual([]);
    expect(normalizeIntervals([{ open: "8", close: "17:00" }])).toEqual([]);
    expect(normalizeIntervals([{ open: "25:00", close: "26:00" }])).toEqual([]);
    expect(normalizeIntervals([{ open: "17:00", close: "08:00" }])).toEqual([]);
    expect(
      normalizeIntervals([
        { open: "08:00", close: "12:00" },
        { open: "", close: "19:00" },
      ]),
    ).toEqual([{ open: "08:00", close: "12:00" }]);
  });

  it("ger högst två pass", () => {
    expect(
      normalizeIntervals([
        { open: "06:00", close: "08:00" },
        { open: "10:00", close: "12:00" },
        { open: "15:00", close: "19:00" },
      ]),
    ).toHaveLength(2);
  });
});
