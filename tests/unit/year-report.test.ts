import { describe, expect, it } from "vitest";
import {
  bestMonth,
  lastMonths,
  monthLabelEs,
  monthSeries,
  monthShortEs,
  reportPath,
  reportToken,
  verifyReportToken,
} from "@/lib/year-report";
import { previewToken } from "@/lib/preview";

describe("rapporttoken (R3-23)", () => {
  it("verifierar sin egen token och inget annat", () => {
    const t = reportToken(7);
    expect(verifyReportToken(7, t)).toBe(true);
    expect(verifyReportToken(8, t)).toBe(false);
    expect(verifyReportToken(7, undefined)).toBe(false);
    expect(verifyReportToken(7, "kort")).toBe(false);
  });

  it("en preview-token öppnar inte rapporten", () => {
    expect(verifyReportToken(7, previewToken(7))).toBe(false);
  });

  it("sökvägen bär slug och token", () => {
    expect(reportPath(7, "taller-lopez")).toBe(`/reporte/taller-lopez?t=${reportToken(7)}`);
  });
});

describe("månader", () => {
  it("tolv månader bakåt över årsskiftet, innevarande sist", () => {
    const months = lastMonths("2026-02-15");
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-03");
    expect(months[11]).toBe("2026-02");
  });

  it("fyller hål med nollor", () => {
    const series = monthSeries(["2026-01", "2026-02"], [{ month: "2026-02", views: 5, waClicks: 1 }]);
    expect(series).toEqual([
      { month: "2026-01", views: 0, waClicks: 0 },
      { month: "2026-02", views: 5, waClicks: 1 },
    ]);
  });

  it("bästa månaden: flest WhatsApp, visningar som tiebreak, null utan trafik", () => {
    expect(
      bestMonth([
        { month: "2026-01", views: 900, waClicks: 3 },
        { month: "2026-02", views: 100, waClicks: 9 },
        { month: "2026-03", views: 300, waClicks: 9 },
      ])?.month,
    ).toBe("2026-03");
    expect(bestMonth([{ month: "2026-01", views: 0, waClicks: 0 }])).toBeNull();
  });

  it("spanska månadsnamn", () => {
    expect(monthLabelEs("2026-03")).toBe("marzo de 2026");
    expect(monthShortEs("2026-09")).toBe("sep");
  });
});
