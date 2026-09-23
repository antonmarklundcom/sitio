import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createResetToken, passwordVersion, validatePassword, verifyResetToken } from "@/lib/password-reset";
import { sendEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import { changePasswordAction } from "@/app/admin/(dashboard)/cuenta/actions";

const accountMocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getSession: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  currentUser: accountMocks.currentUser,
  getSession: accountMocks.getSession,
}));
vi.mock("@/db", () => ({ db: accountMocks }));
vi.mock("next/navigation", () => ({
  redirect: (location: string) => { throw new Error("REDIRECT:" + location); },
}));

const now = 1_800_000_000_000;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("password reset tokens", () => {
  it("round trips the signed identity and expires exactly after 30 minutes", () => {
    const token = createResetToken(42, "admin@example.test", now, "$2a$10$oldhash");
    expect(verifyResetToken(token, now)).toMatchObject({ userId: 42, email: "admin@example.test", expiresAt: now + 1_800_000 });
    expect(verifyResetToken(token, now + 1_799_999)).not.toBeNull();
    expect(verifyResetToken(token, now + 1_800_000)).toBeNull();
  });

  it("rejects a changed email, user ID, expiry or purpose", () => {
    const [payload, mac] = createResetToken(42, "admin@example.test", now, "$2a$10$oldhash").split(".");
    const original = JSON.parse(Buffer.from(payload, "base64url").toString());
    for (const change of [{ email: "other@example.test" }, { userId: 43 }, { expiresAt: now + 9_000_000 }, { purpose: "login" }]) {
      const changed = Buffer.from(JSON.stringify({ ...original, ...change })).toString("base64url");
      expect(verifyResetToken(changed + "." + mac, now)).toBeNull();
    }
  });

  it("rejects malformed signatures and tokens", () => {
    const token = createResetToken(42, "admin@example.test", now, "$2a$10$oldhash");
    for (const invalid of ["", ".", "x.y", token + ".extra", token.slice(0, -5), "!" + token]) {
      expect(verifyResetToken(invalid, now)).toBeNull();
    }
  });

  it("rejects a correctly signed token for a different purpose", () => {
    // An ephemeral test key; no machine credential is read or printed.
    const key = "test-only-".repeat(8);
    vi.stubEnv("SESSION_SECRET", key);
    const payload = Buffer.from(JSON.stringify({ purpose: "login", userId: 42, email: "admin@example.test", expiresAt: now + 1_800_000 })).toString("base64url");
    const mac = createHmac("sha256", key).update("admin-password-reset:" + payload).digest("base64url");
    expect(verifyResetToken(payload + "." + mac, now)).toBeNull();
  });

  it("rejects a token after signing secret changes", () => {
    vi.stubEnv("SESSION_SECRET", "first-test-only-".repeat(4));
    const token = createResetToken(42, "admin@example.test", now, "$2a$10$oldhash");
    vi.stubEnv("SESSION_SECRET", "second-test-only-".repeat(4));
    expect(verifyResetToken(token, now)).toBeNull();
  });
});

describe("validatePassword", () => {
  it("requires at least 10 characters", () => {
    expect(validatePassword("123456789")).not.toBeNull();
    expect(validatePassword("1234567890")).toBeNull();
    expect(validatePassword(null)).not.toBeNull();
    expect(validatePassword(1234567890)).not.toBeNull();
    expect(validatePassword("😀".repeat(5))).not.toBeNull();
    expect(validatePassword("😀".repeat(10))).toBeNull();
  });
  it("rejects bcrypt truncation", () => {
    expect(validatePassword("a".repeat(72))).toBeNull();
    expect(validatePassword("a".repeat(73))).not.toBeNull();
  });
});

describe("reset email transport", () => {
  const message = { to: "admin@example.test", subject: "Restablecé tu contraseña", text: "Development message", html: "<p>Development message</p>" };

  it("logs the message in development without calling Resend when unconfigured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendEmail(message)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("[email:development]", message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails clearly without logging the message in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(sendEmail(message)).rejects.toThrow("RESEND_API_KEY");
    expect(log).not.toHaveBeenCalled();
  });

  it("posts the email and handles a rejected provider response", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-only-placeholder");
    vi.stubEnv("RESEND_FROM", "sender@example.test");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail(message);
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ from: "sender@example.test", ...message }),
    }));
    fetchMock.mockResolvedValue({ ok: false, status: 422 });
    await expect(sendEmail(message)).rejects.toThrow("HTTP 422");
  });
});

describe("account password action redirects", () => {
  async function setupAccount() {
    vi.clearAllMocks();
    accountMocks.currentUser.mockResolvedValue({ userId: 42, role: "superadmin", name: "Test admin" });
    const passwordHash = await bcrypt.hash("CorrectCurrent-2026", 10);
    accountMocks.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [{ id: 42, passwordHash }] }) }),
    });
    const set = vi.fn().mockReturnValue({ where: async () => [{ affectedRows: 1 }] });
    accountMocks.update.mockReturnValue({ set });
    const values = vi.fn().mockResolvedValue(undefined);
    accountMocks.insert.mockReturnValue({ values });
    return { set, values };
  }

  function form(current: string) {
    const data = new FormData();
    data.set("current", current);
    data.set("password", "OtraClave-2026");
    data.set("repeat", "OtraClave-2026");
    return data;
  }

  it("keeps a signed-in user on the account error route for a wrong current password", async () => {
    await setupAccount();
    await expect(changePasswordAction(form("wrong-password"))).rejects.toThrow("REDIRECT:/admin/cuenta?error=current");
    expect(accountMocks.currentUser).toHaveBeenCalledOnce();
    expect(accountMocks.getSession).not.toHaveBeenCalled();
    expect(accountMocks.update).not.toHaveBeenCalled();
    expect(accountMocks.insert).not.toHaveBeenCalled();
  });

  it("updates the hash, logs the change and redirects to the account success route", async () => {
    const { set, values } = await setupAccount();
    await expect(changePasswordAction(form("CorrectCurrent-2026"))).rejects.toThrow("REDIRECT:/admin/cuenta?guardada=1");
    expect(await bcrypt.compare("OtraClave-2026", set.mock.calls[0][0].passwordHash)).toBe(true);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 42, action: "contrasena_cambiada" }));
    expect(accountMocks.getSession).not.toHaveBeenCalled();
  });

  it("redirects to login only when the session is absent", async () => {
    await setupAccount();
    accountMocks.currentUser.mockResolvedValue(null);
    await expect(changePasswordAction(form("wrong-password"))).rejects.toThrow("REDIRECT:/admin/login");
    expect(accountMocks.select).not.toHaveBeenCalled();
  });
});

describe("engångslänk (R3-37)", () => {
  it("bär lösenordsversionen, och en ny hash ger en annan version", () => {
    const now = Date.UTC(2026, 8, 23);
    const claims = verifyResetToken(createResetToken(42, "admin@example.test", now, "$2a$10$oldhash"), now);
    expect(claims?.pv).toBe(passwordVersion("$2a$10$oldhash"));
    expect(claims?.pv).not.toBe(passwordVersion("$2a$10$newhash"));
    expect(claims?.pv).not.toContain("oldhash");
  });
});
