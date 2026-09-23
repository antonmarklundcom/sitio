import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

const TTL = 30 * 60_000;
const PURPOSE = "admin-password-reset";
type ResetClaims = { purpose: typeof PURPOSE; userId: number; email: string; expiresAt: number; pv: string };

/**
 * Lösenordsversionen (R3-37): en HMAC av nuvarande lösenordshash, inte hashen
 * själv. När lösenordet byts slutar alla länkar som skapats före bytet att
 * gälla — förr gick en läckt länk att använda igen i 30 minuter, även efter
 * att den riktiga användaren redan bytt lösenord med den.
 */
export function passwordVersion(passwordHash: string | null | undefined): string {
  return createHmac("sha256", env.sessionSecret).update("pv:" + (passwordHash ?? "")).digest("hex").slice(0, 16);
}

function signature(payload: string): Buffer {
  return createHmac("sha256", env.sessionSecret).update(PURPOSE + ":" + payload).digest();
}

/** now is milliseconds since the Unix epoch; no clock or database side effects. */
export function createResetToken(userId: number, email: string, now: number, passwordHash: string | null): string {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !email || !Number.isSafeInteger(now)) {
    throw new Error("Invalid reset claims.");
  }
  const claims: ResetClaims = { purpose: PURPOSE, userId, email, expiresAt: now + TTL, pv: passwordVersion(passwordHash) };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return payload + "." + signature(payload).toString("base64url");
}

export function verifyResetToken(token: string, now: number): ResetClaims | null {
  if (typeof token !== "string" || token.length > 2048 || !Number.isSafeInteger(now)) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  const [payload, mac] = parts;
  const received = Buffer.from(mac, "base64url");
  const expected = signature(payload);
  if (received.length !== expected.length || received.toString("base64url") !== mac || !timingSafeEqual(received, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ResetClaims;
    if (!claims || claims.purpose !== PURPOSE || !Number.isSafeInteger(claims.userId) || claims.userId <= 0 ||
        typeof claims.email !== "string" || !claims.email || !Number.isSafeInteger(claims.expiresAt) ||
        typeof claims.pv !== "string" || !claims.pv ||
        claims.expiresAt <= now || claims.expiresAt > now + TTL) return null;
    return claims;
  } catch {
    return null;
  }
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== "string" || [...value].length < 10) return "Usá una contraseña de al menos 10 caracteres.";
  // bcrypt ignores bytes after 72; reject instead of silently truncating.
  if (Buffer.byteLength(value, "utf8") > 72) return "Usá una contraseña de hasta 72 bytes.";
  return null;
}

