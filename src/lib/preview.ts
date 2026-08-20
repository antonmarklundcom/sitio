import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Preview-token är en HMAC av businessId — inget att lagra, inget att städa,
 * och den slutar gälla automatiskt om SESSION_SECRET roteras.
 */
export function previewToken(businessId: number): string {
  return createHmac("sha256", env.sessionSecret)
    .update(`preview:${businessId}`)
    .digest("hex")
    .slice(0, 24);
}

export function verifyPreviewToken(businessId: number, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = previewToken(businessId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
