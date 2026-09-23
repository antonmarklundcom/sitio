import { describe, expect, it } from "vitest";
import { DIAG_ENV, envPresence, pickHeaders } from "@/lib/diagnostics";

describe("pickHeaders", () => {
  it("visar proxyheaders i fast ordning, null när de saknas", () => {
    const out = pickHeaders(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1", host: "sitio.com.py" }));
    expect(out.map((h) => h.name)).toEqual(["x-forwarded-for", "x-real-ip", "forwarded", "cf-connecting-ip", "host", "x-forwarded-proto"]);
    expect(out[0].value).toBe("203.0.113.9, 10.0.0.1");
    expect(out[1].value).toBeNull();
  });
});

describe("envPresence", () => {
  it("ger bara sant/falskt, aldrig värdet", () => {
    const secret = "re_supersecretvalue";
    const out = envPresence({ RESEND_API_KEY: secret, CRON_SECRET: "   ", VENDERCRM_URL: "" });
    expect(out.map((e) => e.name)).toEqual([...DIAG_ENV]);
    expect(out.find((e) => e.name === "RESEND_API_KEY")?.set).toBe(true);
    expect(out.find((e) => e.name === "CRON_SECRET")?.set).toBe(false);
    expect(out.find((e) => e.name === "VENDERCRM_URL")?.set).toBe(false);
    expect(JSON.stringify(out)).not.toContain(secret);
  });
});
