import { describe, expect, it } from "vitest";
import {
  MAX_FAILURES,
  buildLeadPayload,
  decideAfterSend,
  endpointHash,
  outcomeFromStatus,
  pushSubscriptionSchema,
} from "@/lib/push";
import type { NewLeadNotice } from "@/lib/lead-notify";

const base: NewLeadNotice = {
  businessId: 1,
  leadId: 7,
  kind: "consulta",
  name: "Ana",
  message: "Hola, ¿tienen lugar?",
  serviceName: null,
  requestedDay: null,
  requestedTime: null,
};

describe("buildLeadPayload", () => {
  it("consulta: nombre y mensaje", () => {
    const p = buildLeadPayload(base, "Peluquería Sol");
    expect(p.title).toBe("Nueva consulta");
    expect(p.body).toContain("Ana: Hola");
    expect(p.url).toBe("/mi-sitio/clientes");
    expect(p.tag).toBe("lead-7");
  });
  it("turno: servicio y día", () => {
    const p = buildLeadPayload({ ...base, kind: "turno", message: null, serviceName: "Corte", requestedDay: "2026-10-05", requestedTime: "15:00" }, "Sol");
    expect(p.title).toBe("Nuevo turno");
    expect(p.body).toContain("Ana: Corte · 05/10 · 15:00");
  });
  it("recorta mensajes largos", () => {
    const p = buildLeadPayload({ ...base, message: "x".repeat(500) }, "Sol");
    expect(p.body.length).toBeLessThanOrEqual(160);
  });
});

describe("pushSubscriptionSchema", () => {
  const ok = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "k", auth: "a" } };
  it("accepterar en giltig prenumeration", () => {
    expect(pushSubscriptionSchema.safeParse(ok).success).toBe(true);
  });
  it("kräver https", () => {
    expect(pushSubscriptionSchema.safeParse({ ...ok, endpoint: "http://x.example/a" }).success).toBe(false);
  });
  it("respekterar kolumnlängderna", () => {
    expect(pushSubscriptionSchema.safeParse({ ...ok, endpoint: `https://x.example/${"a".repeat(2000)}` }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ ...ok, keys: { p256dh: "k".repeat(201), auth: "a" } }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ ...ok, keys: { p256dh: "k", auth: "a".repeat(65) } }).success).toBe(false);
  });
  it("kräver nycklar", () => {
    expect(pushSubscriptionSchema.safeParse({ endpoint: ok.endpoint }).success).toBe(false);
  });
});

describe("decideAfterSend", () => {
  it("lyckat nollställer fel", () => {
    expect(decideAfterSend("ok", 3)).toEqual({ action: "update", failures: 0, markOk: true });
  });
  it("404/410 raderar direkt", () => {
    expect(outcomeFromStatus(404)).toBe("gone");
    expect(outcomeFromStatus(410)).toBe("gone");
    expect(outcomeFromStatus(500)).toBe("error");
    expect(outcomeFromStatus(undefined)).toBe("error");
    expect(decideAfterSend("gone", 0)).toEqual({ action: "delete" });
  });
  it("övriga fel räknas upp och raderar vid taket", () => {
    expect(decideAfterSend("error", 0)).toEqual({ action: "update", failures: 1, markOk: false });
    expect(decideAfterSend("error", MAX_FAILURES - 2)).toEqual({ action: "update", failures: MAX_FAILURES - 1, markOk: false });
    expect(decideAfterSend("error", MAX_FAILURES - 1)).toEqual({ action: "delete" });
  });
});

describe("endpointHash", () => {
  it("är sha256 hex", () => {
    expect(endpointHash("https://a.example")).toMatch(/^[0-9a-f]{64}$/);
  });
});
