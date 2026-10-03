import { describe, expect, it } from "vitest";
import {
  addCustomerSchema,
  canTransition,
  crmReplyMessage,
  csvCell,
  isFollowUpDue,
  leadsToCsv,
  monthStart,
  normalizeRefCode,
  parsePage,
  parseSearch,
  parseTab,
  refCustomerSchema,
  selectableStatuses,
  statusAfterReply,
  statusLabel,
  updateLeadSchema,
} from "@/lib/crm";

describe("status", () => {
  it("labels, including legacy cerrado", () => {
    expect(statusLabel("nuevo")).toBe("Nueva");
    expect(statusLabel("contactado")).toBe("Respondida");
    expect(statusLabel("cliente")).toBe("Cliente");
    expect(statusLabel("perdido")).toBe("Perdida");
    expect(statusLabel("cerrado")).toBe("Cerrada");
  });

  it("offers cerrado only to leads that already have it", () => {
    expect(selectableStatuses("nuevo")).not.toContain("cerrado");
    expect(selectableStatuses("cerrado")).toContain("cerrado");
    expect(canTransition("nuevo", "cerrado")).toBe(false);
    expect(canTransition("cerrado", "cerrado")).toBe(true);
    expect(canTransition("cerrado", "cliente")).toBe(true);
    expect(canTransition("perdido", "nuevo")).toBe(true);
    expect(canTransition("nuevo", "bogus")).toBe(false);
  });

  it("reply only advances a new lead", () => {
    expect(statusAfterReply("nuevo")).toBe("contactado");
    expect(statusAfterReply("contactado")).toBeNull();
    expect(statusAfterReply("cliente")).toBeNull();
    expect(statusAfterReply("perdido")).toBeNull();
  });
});

describe("tabs, page, search", () => {
  it("falls back to nuevas", () => {
    expect(parseTab("clientes")).toBe("clientes");
    expect(parseTab("x")).toBe("nuevas");
    expect(parseTab(undefined)).toBe("nuevas");
  });

  it("parses pages", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("1.5")).toBe(1);
  });

  it("searches names and phones", () => {
    expect(parseSearch("")).toEqual({ text: null, phone: null, phoneDigits: null });
    expect(parseSearch("Ana")).toEqual({ text: "Ana", phone: null, phoneDigits: null });
    expect(parseSearch("0981 123 456")).toEqual({ text: null, phone: "+595981123456", phoneDigits: "981123456" });
    expect(parseSearch("123 456")).toEqual({ text: null, phone: null, phoneDigits: "123456" });
  });
});

describe("follow-up", () => {
  const today = "2026-10-03";
  it("is due today or earlier on open leads", () => {
    expect(isFollowUpDue("2026-10-03", "contactado", today)).toBe(true);
    expect(isFollowUpDue(new Date("2026-10-01T00:00:00Z"), "nuevo", today)).toBe(true);
    expect(isFollowUpDue("2026-10-04", "nuevo", today)).toBe(false);
    expect(isFollowUpDue(null, "nuevo", today)).toBe(false);
  });
  it("is never due once resolved", () => {
    expect(isFollowUpDue("2026-10-01", "cliente", today)).toBe(false);
    expect(isFollowUpDue("2026-10-01", "perdido", today)).toBe(false);
    expect(isFollowUpDue("2026-10-01", "cerrado", today)).toBe(false);
  });
  it("month start", () => {
    expect(monthStart("2026-10-03")).toBe("2026-10-01");
  });
});

describe("normalizeRefCode", () => {
  it("normalises the usual shapes", () => {
    expect(normalizeRefCode("k7q2")).toBe("K7Q2");
    expect(normalizeRefCode(" ref K7Q2 ")).toBe("K7Q2");
    expect(normalizeRefCode("REF: k7q2")).toBe("K7Q2");
    expect(normalizeRefCode("ref-k7q2")).toBe("K7Q2");
    expect(normalizeRefCode("refk7q2")).toBe("K7Q2");
  });
  it("keeps a bare code that starts with REF", () => {
    expect(normalizeRefCode("REFX")).toBe("REFX");
  });
  it("rejects bad codes", () => {
    expect(normalizeRefCode("")).toBeNull();
    expect(normalizeRefCode("K7Q")).toBeNull();
    expect(normalizeRefCode("K7Q22")).toBeNull();
    expect(normalizeRefCode("K7Q1")).toBeNull(); // 1 finns inte i alfabetet
    expect(normalizeRefCode("K7QO")).toBeNull(); // O inte heller
    expect(normalizeRefCode(null)).toBeNull();
  });
});

describe("schemas", () => {
  it("parses Gs values in Paraguayan style", () => {
    const base = { leadId: "5", status: "cliente", notes: "", followUpDay: "" };
    expect(updateLeadSchema.parse({ ...base, valueGs: "150.000" }).valueGs).toBe(150000);
    expect(updateLeadSchema.parse({ ...base, valueGs: "₲ 1.500.000" }).valueGs).toBe(1500000);
    expect(updateLeadSchema.parse({ ...base, valueGs: "" }).valueGs).toBeNull();
    expect(updateLeadSchema.safeParse({ ...base, valueGs: "35 mil" }).success).toBe(false);
    expect(updateLeadSchema.safeParse({ ...base, valueGs: "1,5" }).success).toBe(false);
  });

  it("limits notes to 2000 and checks dates", () => {
    const base = { leadId: "5", status: "nuevo", valueGs: "", followUpDay: "2026-10-05" };
    expect(updateLeadSchema.safeParse({ ...base, notes: "x".repeat(2000) }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ ...base, notes: "x".repeat(2001) }).success).toBe(false);
    expect(updateLeadSchema.safeParse({ ...base, notes: "", followUpDay: "2026-02-31" }).success).toBe(false);
    expect(updateLeadSchema.parse({ ...base, notes: " ", followUpDay: "" })).toMatchObject({ notes: null, followUpDay: null });
  });

  it("rejects an unknown status and bad ids", () => {
    expect(updateLeadSchema.safeParse({ leadId: "5", status: "ganado", notes: "", followUpDay: "", valueGs: "" }).success).toBe(false);
    expect(updateLeadSchema.safeParse({ leadId: "-1", status: "nuevo", notes: "", followUpDay: "", valueGs: "" }).success).toBe(false);
  });

  it("requires a Paraguayan phone", () => {
    expect(addCustomerSchema.parse({ name: " Ana ", phone: "0981 123 456", note: "", followUpDay: "" })).toEqual({
      name: "Ana",
      phone: "+595981123456",
      note: null,
      followUpDay: null,
    });
    expect(addCustomerSchema.safeParse({ name: "Ana", phone: "123", note: "", followUpDay: "" }).success).toBe(false);
    expect(addCustomerSchema.safeParse({ name: "", phone: "0981123456", note: "", followUpDay: "" }).success).toBe(false);
  });

  it("normalises the code in the ref form", () => {
    expect(refCustomerSchema.parse({ code: "ref k7q2", name: "Ana", phone: "981123456" }).code).toBe("K7Q2");
    expect(refCustomerSchema.safeParse({ code: "zzz", name: "Ana", phone: "981123456" }).success).toBe(false);
  });
});

describe("csv", () => {
  it("guards formula injection", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+595981123456")).toBe("'+595981123456");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("Ana")).toBe("Ana");
  });
  it("escapes quotes, commas and newlines", () => {
    expect(csvCell('di "hola", Ana')).toBe('"di ""hola"", Ana"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(150000)).toBe("150000");
  });
  it("writes a BOM, header and rows", () => {
    const csv = leadsToCsv([
      {
        name: "=Ana",
        phone: "+595981123456",
        kind: "manual",
        status: "cliente",
        source: null,
        message: null,
        notes: "ok, listo",
        followUpDay: new Date("2026-10-05T00:00:00Z"),
        valueGs: 150000,
        createdAt: new Date("2026-10-01T12:00:00Z"),
      },
    ]);
    expect(csv.startsWith("﻿Nombre,")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(`'=Ana,'+595981123456,Agregado a mano,Cliente,,,"ok, listo",2026-10-05,150000,2026-10-01`);
  });
});

describe("crmReplyMessage", () => {
  it("handles every kind", () => {
    expect(crmReplyMessage({ name: "Ana Paz", kind: "consulta" }, "Casa X")).toContain("la consulta que dejaste");
    expect(crmReplyMessage({ name: "Ana Paz", kind: "turno", serviceName: "Corte" }, "Casa X")).toContain("turno para Corte");
    expect(crmReplyMessage({ name: "Ana Paz", kind: "whatsapp" }, "Casa X")).toBe("Hola Ana! Te escribo de Casa X, para seguir con tu consulta.");
    expect(crmReplyMessage({ name: "Ana Paz", kind: "manual" }, "Casa X")).toBe("Hola Ana! Te escribo de Casa X.");
  });
});
