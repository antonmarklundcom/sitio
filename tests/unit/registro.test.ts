import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/auth", () => ({ logActivity: vi.fn() }));
import { registroSchema } from "@/lib/intake-create";
import { CATEGORIES } from "@/lib/business";

const valid = { name: "Taller López", category: "taller", phone: "0981 123 456", website: "" };

describe("registroSchema", () => {
  it("normalizes phone, trims name and defaults city", () => {
    expect(registroSchema.parse({ ...valid, name: " Taller López ", city: " " })).toEqual({ ...valid, phone: "+595981123456", city: "Asunción" });
    expect(registroSchema.parse(valid).city).toBe("Asunción");
  });
  it("accepts every configured category and name boundaries", () => {
    for (const category of CATEGORIES) expect(registroSchema.safeParse({ ...valid, category }).success).toBe(true);
    for (const length of [2, 120]) expect(registroSchema.safeParse({ ...valid, name: "x".repeat(length) }).success).toBe(true);
  });
  it.each([{ name: " " }, { name: "x" }, { name: "x".repeat(121) }, { category: "invalid" }, { phone: "" }, { phone: "123" }, { city: "x".repeat(81) }])("rejects invalid fields %j", fields => {
    expect(registroSchema.safeParse({ ...valid, ...fields }).success).toBe(false);
  });
  it("rejects any filled honeypot, including whitespace", () => {
    for (const website of ["https://example.com", " "]) expect(registroSchema.safeParse({ ...valid, website }).success).toBe(false);
  });
});
