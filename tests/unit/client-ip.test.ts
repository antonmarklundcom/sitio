import { describe, expect, it } from "vitest";
import { clientIpFrom, clientIpSource } from "@/lib/client-ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIpFrom (R3-27)", () => {
  const spoofed = h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9", "x-real-ip": "203.0.113.9" });

  it("xff-first tar första posten (dagens beteende)", () => {
    expect(clientIpFrom(spoofed, "xff-first")).toBe("6.6.6.6");
  });

  it("xff-last och x-real-ip tar proxyns värde, inte klientens påhitt", () => {
    expect(clientIpFrom(spoofed, "xff-last")).toBe("203.0.113.9");
    expect(clientIpFrom(spoofed, "x-real-ip")).toBe("203.0.113.9");
  });

  it("faller tillbaka när vald header saknas", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "198.51.100.7" }), "x-real-ip")).toBe("198.51.100.7");
    expect(clientIpFrom(h({ "x-real-ip": " 198.51.100.8 " }), "xff-last")).toBe("198.51.100.8");
    expect(clientIpFrom(h({}), "xff-first")).toBe("unknown");
  });
});

describe("clientIpSource", () => {
  it("okänt eller tomt värde ger xff-first", () => {
    expect(clientIpSource(undefined)).toBe("xff-first");
    expect(clientIpSource("")).toBe("xff-first");
    expect(clientIpSource("cf-connecting-ip")).toBe("xff-first");
    expect(clientIpSource(" XFF-LAST ")).toBe("xff-last");
  });
});
