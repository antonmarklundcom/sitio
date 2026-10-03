import "server-only";
import type { NewLeadNotice } from "./lead-notify";

/** STUB (crm-1) — implementeras av e-postdelen. Får aldrig kasta. */
export async function sendLeadEmail(_to: string, _lead: NewLeadNotice, _businessName: string): Promise<void> {}
