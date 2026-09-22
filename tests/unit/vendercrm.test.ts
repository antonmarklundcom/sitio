import { describe, expect, it, vi } from "vitest";
import { hotLeadIdempotencyKey, hotLeadPayload, pushLead, venderCrmConfig } from "@/lib/vendercrm";

const lead = {
  businessId: 7,
  name: "Pizzería La Nona",
  slug: "pizzeria-la-nona",
  category: "gastronomia",
  whatsappPhone: "+595981123456",
  waClicks30d: 23,
  views30d: 410,
  upsellScore: 60,
  subscriptionStatus: "active",
  subscriptionExpiresAt: "2027-03-01",
};

describe("venderCrmConfig (R3-22)", () => {
  it("är avstängd utan URL eller nyckel", () => {
    expect(venderCrmConfig("", "")).toBeNull();
    expect(venderCrmConfig("https://crm.example.com", "")).toBeNull();
    expect(venderCrmConfig("", "key")).toBeNull();
  });

  it("trimmar och tar bort avslutande snedstreck", () => {
    expect(venderCrmConfig(" https://crm.example.com/ ", " k ")).toEqual({ url: "https://crm.example.com", apiKey: "k" });
  });
});

describe("hotLeadPayload", () => {
  it("bygger en lead utan pipeline/steg/ägare, med stabil nyckel", () => {
    const p = hotLeadPayload(lead, "https://sitio.com.py/pizzeria-la-nona", "2026-09-22");
    expect(p.phone).toBe("+595981123456");
    expect(p.source).toBe("sitio:hot-lead");
    expect(p.page_url).toBe("https://sitio.com.py/pizzeria-la-nona");
    expect(p.message).toContain("23 clics en WhatsApp");
    expect(p.fields).toMatchObject({ business_id: 7, wa_clicks_30d: 23, visitas_30d: 410 });
    for (const routing of ["pipeline", "stage", "owner", "tag", "tags"]) expect(p).not.toHaveProperty(routing);
    expect(p.idempotency_key).toBe(hotLeadIdempotencyKey(7, "2026-09-22"));
    expect(p.idempotency_key.length).toBeGreaterThanOrEqual(8);
  });

  it("samma sajt samma dygn = samma nyckel, annat dygn = ny", () => {
    expect(hotLeadIdempotencyKey(7, "2026-09-22")).toBe(hotLeadIdempotencyKey(7, "2026-09-22"));
    expect(hotLeadIdempotencyKey(7, "2026-09-23")).not.toBe(hotLeadIdempotencyKey(7, "2026-09-22"));
    expect(hotLeadIdempotencyKey(8, "2026-09-22")).not.toBe(hotLeadIdempotencyKey(7, "2026-09-22"));
  });
});

describe("pushLead", () => {
  const config = { url: "https://crm.example.com", apiKey: "secret" };
  const payload = hotLeadPayload(lead, "https://sitio.com.py/x", "2026-09-22");

  it("postar med nyckeln i headern och räknar 201 och 200 som framgång", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ duplicate: false }), { status: 201 }));
    expect(await pushLead(config, payload, fetchImpl as unknown as typeof fetch)).toEqual({
      ok: true,
      status: 201,
      duplicate: false,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://crm.example.com/api/v1/leads");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("secret");

    const replay = vi.fn(async () => new Response(JSON.stringify({ duplicate: true }), { status: 200 }));
    expect(await pushLead(config, payload, replay as unknown as typeof fetch)).toMatchObject({
      ok: true,
      duplicate: true,
    });
  });

  it("returnerar felet i stället för att kasta", async () => {
    const denied = vi.fn(async () => new Response("invalid key", { status: 401 }));
    expect(await pushLead(config, payload, denied as unknown as typeof fetch)).toEqual({
      ok: false,
      status: 401,
      error: "invalid key",
    });
    const down = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await pushLead(config, payload, down as unknown as typeof fetch)).toEqual({
      ok: false,
      status: null,
      error: "ECONNREFUSED",
    });
  });
});
