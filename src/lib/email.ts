import "server-only";
import { env } from "./env";

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Visningsnamn för avsändaren i just det här mejlet (standard: EMAIL_FROM_NAME). */
  fromName?: string;
  replyTo?: string;
};

/**
 * Cloudflare Email Service (Email Sending, beta). Ren funktion så att formen på
 * JSON-kroppen kan testas utan nätverk.
 */
export function buildCloudflarePayload(message: Email, from: string, defaultName: string) {
  return {
    from: { email: from, name: message.fromName?.trim() || defaultName },
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  };
}

export function emailConfigured(): boolean {
  return Boolean(env.cloudflareAccountId && env.cloudflareEmailToken && env.emailFrom);
}

export async function sendEmail(message: Email): Promise<void> {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.info("[email:development]", message);
      return;
    }
    throw new Error("CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_EMAIL_TOKEN and EMAIL_FROM are required to send emails outside development.");
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.cloudflareAccountId)}/email/sending/send`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.cloudflareEmailToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildCloudflarePayload(message, env.emailFrom, env.emailFromName)),
    signal: AbortSignal.timeout(10_000),
  });
  // Provider response bodies may contain personal data; never log them.
  if (!response.ok) throw new Error(`Email delivery failed (HTTP ${response.status}).`);
}
