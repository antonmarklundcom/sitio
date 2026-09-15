import "server-only";
import { env } from "./env";

type Email = { to: string; subject: string; text: string; html: string };

export async function sendEmail(message: Email): Promise<void> {
  const key = env.resendApiKey;
  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info("[email:development]", message);
      return;
    }
    throw new Error("RESEND_API_KEY is required to send password reset emails outside development.");
  }
  if (!env.resendFrom) throw new Error("RESEND_FROM is required to send emails.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.resendFrom, ...message }),
    signal: AbortSignal.timeout(10_000),
  });
  // Provider response bodies may contain personal data; never log them.
  if (!response.ok) throw new Error(`Email delivery failed (HTTP ${response.status}).`);
}

