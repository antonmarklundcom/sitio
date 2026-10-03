import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { sendLeadEmail } from "./notify-email";
import { sendLeadPush } from "./push";

/**
 * En ny consulta/turno → ägarens telefon (Web Push) och mejl (Cloudflare),
 * crm-1. Båda kanalerna är valfria och tysta när de inte är inställda.
 * Kastar aldrig: besökarens formulär får inte fallera för att en notis gick fel.
 */
export type NewLeadNotice = {
  businessId: number;
  leadId: number;
  kind: "consulta" | "turno";
  name: string;
  message: string | null;
  serviceName: string | null;
  requestedDay: string | null; // YYYY-MM-DD
  requestedTime: string | null;
};

export async function notifyNewLead(lead: NewLeadNotice): Promise<void> {
  try {
    const [business] = await db
      .select({ name: businesses.name, notifyEmail: businesses.notifyEmail })
      .from(businesses)
      .where(eq(businesses.id, lead.businessId))
      .limit(1);
    if (!business) return;
    await Promise.allSettled([
      sendLeadPush(lead, business.name),
      business.notifyEmail ? sendLeadEmail(business.notifyEmail, lead, business.name) : Promise.resolve(),
    ]);
  } catch {
    // Notisen är en bonus; consultan är redan sparad och syns i panelen.
  }
}
