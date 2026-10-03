import "server-only";
import type { NewLeadNotice } from "./lead-notify";

/** STUB (crm-1) — implementeras av push-delen. Får aldrig kasta. */
export async function sendLeadPush(_lead: NewLeadNotice, _businessName: string): Promise<void> {}
