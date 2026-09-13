import { describe, expect, it } from "vitest";
import { classifyDevice, clientIp, dayKeyAsuncion, isEventType, referrerHost, visitorHash } from "@/lib/analytics";

describe("classifyDevice", () => {
  it("klassar självdeklarerande botar som bot", () => {
    expect(classifyDevice("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe("bot");
    expect(classifyDevice("WhatsApp/2.23")).toBe("bot");
    expect(classifyDevice("curl/8.5.0")).toBe("bot");
  });

  it("klassar mobila UA som mobile", () => {
    expect(classifyDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari")).toBe("mobile");
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 14) Chrome Mobile")).toBe("mobile");
  });

  it("klassar resten som desktop", () => {
    expect(classifyDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120")).toBe("desktop");
  });

  it("ger unknown när UA saknas", () => {
    expect(classifyDevice(null)).toBe("unknown");
    expect(classifyDevice("")).toBe("unknown");
  });

  it("låter bot vinna över mobile när båda matchar", () => {
    expect(classifyDevice("Mozilla/5.0 (iPhone) facebookexternalhit/1.1")).toBe("bot");
  });
});

describe("isEventType", () => {
  it("känner igen de definierade händelserna", () => {
    expect(isEventType("whatsapp_click")).toBe(true);
    expect(isEventType("page_view")).toBe(true);
  });

  it("avvisar okända och icke-strängar", () => {
    expect(isEventType("click")).toBe(false);
    expect(isEventType(42)).toBe(false);
    expect(isEventType(null)).toBe(false);
  });
});

describe("dayKeyAsuncion", () => {
  it("ger dagen i Asunción, inte i UTC", () => {
    expect(dayKeyAsuncion(new Date("2026-09-14T02:00:00Z"))).toBe("2026-09-13");
    expect(dayKeyAsuncion(new Date("2026-09-14T03:00:00Z"))).toBe("2026-09-14");
  });

  it("formaterar som YYYY-MM-DD", () => {
    expect(dayKeyAsuncion(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });
});

describe("visitorHash", () => {
  it("är 32 tecken hex", () => {
    const h = visitorHash("1.2.3.4", "UA", "2026-09-13");
    expect(h).toHaveLength(32);
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });

  it("är stabil inom samma dygn", () => {
    expect(visitorHash("1.2.3.4", "UA", "2026-09-13")).toBe(visitorHash("1.2.3.4", "UA", "2026-09-13"));
  });

  it("går inte att koppla ihop mellan två dygn", () => {
    expect(visitorHash("1.2.3.4", "UA", "2026-09-13")).not.toBe(visitorHash("1.2.3.4", "UA", "2026-09-14"));
  });

  it("skiljer på olika IP och olika UA", () => {
    expect(visitorHash("1.2.3.4", "UA", "2026-09-13")).not.toBe(visitorHash("1.2.3.5", "UA", "2026-09-13"));
    expect(visitorHash("1.2.3.4", "UA", "2026-09-13")).not.toBe(visitorHash("1.2.3.4", "UB", "2026-09-13"));
  });
});

describe("clientIp", () => {
  it("tar första posten i x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });

  it("faller tillbaka på x-real-ip", () => {
    expect(clientIp(new Headers({ "x-real-ip": " 198.51.100.7 " }))).toBe("198.51.100.7");
  });

  it("ger 'unknown' när ingen header finns", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("referrerHost", () => {
  it("sparar bara värdnamnet, aldrig sökvägen eller frågan", () => {
    expect(referrerHost("https://www.google.com/search?q=taller+lopez", "sitio.com.py")).toBe("www.google.com");
  });

  it("strippar den egna värden", () => {
    expect(referrerHost("https://sitio.com.py/taller-lopez", "sitio.com.py")).toBeNull();
    expect(referrerHost("https://SITIO.com.py/x", "sitio.com.py")).toBeNull();
  });

  it("ger null för tomt, icke-sträng och trasig URL", () => {
    expect(referrerHost("", "sitio.com.py")).toBeNull();
    expect(referrerHost(null, "sitio.com.py")).toBeNull();
    expect(referrerHost(123, "sitio.com.py")).toBeNull();
    expect(referrerHost("inte en url", "sitio.com.py")).toBeNull();
  });

  it("behåller externa värdar när egen värd är okänd", () => {
    expect(referrerHost("https://m.facebook.com/", null)).toBe("m.facebook.com");
  });
});
