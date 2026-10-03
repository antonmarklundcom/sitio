import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCloudflarePayload, sendEmail } from "@/lib/email";
import { buildLeadEmail, sendLeadEmail } from "@/lib/notify-email";
import type { NewLeadNotice } from "@/lib/lead-notify";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const lead: NewLeadNotice = {
  businessId: 1,
  leadId: 2,
  kind: "consulta",
  name: "<b>Ana</b>",
  message: "<script>alert(1)</script> & hola",
  serviceName: null,
  requestedDay: null,
  requestedTime: null,
};

function configure() {
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc123");
  vi.stubEnv("CLOUDFLARE_EMAIL_TOKEN", "tok-test");
  vi.stubEnv("EMAIL_FROM", "avisos@example.test");
}

describe("buildCloudflarePayload", () => {
  const base = { to: "a@example.test", subject: "S", text: "T", html: "<p>T</p>" };

  it("usa standardnamnet och utelämnar reply_to när det saknas", () => {
    expect(buildCloudflarePayload(base, "avisos@example.test", "sitio.com.py")).toEqual({
      from: { address: "avisos@example.test", name: "sitio.com.py" },
      ...base,
    });
  });

  it("tar fromName och replyTo per meddelande", () => {
    const p = buildCloudflarePayload({ ...base, fromName: "Café Sol vía sitio.com.py", replyTo: "r@example.test" }, "avisos@example.test", "x");
    expect(p.from.name).toBe("Café Sol vía sitio.com.py");
    expect(p).toMatchObject({ reply_to: "r@example.test" });
  });
});

describe("sendEmail", () => {
  it("anropar Cloudflare med bearer-token och läcker varken token eller svarskropp i felet", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "secret body" });
    vi.stubGlobal("fetch", fetchMock);
    const err = await sendEmail({ to: "a@example.test", subject: "S", text: "T", html: "H" }).catch((e: Error) => e);
    expect((err as Error).message).toBe("Email delivery failed (HTTP 403).");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acc123/email/sending/send");
    expect(init.headers.Authorization).toBe("Bearer tok-test");
  });
});

describe("buildLeadEmail", () => {
  it("escapar all användartext i html men inte i ren text", () => {
    const { html, text, subject } = buildLeadEmail(lead, "Café <Sol>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Ana</b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; hola");
    expect(html).toContain("Café &lt;Sol&gt;");
    expect(html).toContain("/mi-sitio/clientes");
    expect(text).toContain("& hola");
    expect(subject).toBe("Nueva consulta de <b>Ana</b> en tu página");
  });

  it("turno: ämne, tjänst, dag och tid", () => {
    const { subject, text } = buildLeadEmail(
      { ...lead, kind: "turno", name: "Ana", message: null, serviceName: "Corte", requestedDay: "2026-10-05", requestedTime: "10:30" },
      "Café",
    );
    expect(subject).toBe("Nuevo pedido de turno de Ana");
    expect(text).toContain("Servicio: Corte");
    expect(text).toContain("Día: 05/10/2026");
    expect(text).toContain("Hora: 10:30");
  });
});

describe("sendLeadEmail", () => {
  it("är en no-op utan konfiguration", async () => {
    vi.stubEnv("CLOUDFLARE_EMAIL_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendLeadEmail("owner@example.test", lead, "Café")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skickar inte till ogiltig adress", async () => {
    configure();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await sendLeadEmail("not an email", lead, "Café");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skickar med företagsnamn som avsändarnamn och kastar aldrig", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    await sendLeadEmail("owner@example.test", lead, "Café Sol");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toEqual({ address: "avisos@example.test", name: "Café Sol vía sitio.com.py" });
    expect(body.to).toBe("owner@example.test");
    fetchMock.mockRejectedValue(new Error("network"));
    await expect(sendLeadEmail("owner@example.test", lead, "Café Sol")).resolves.toBeUndefined();
  });
});
