import "server-only";
import { absoluteUrl } from "./env";
import { renewalMessage } from "./billing";
import { waLink } from "./format";
import { monthlyStatsMessage } from "./growth";
import { reportPath } from "./year-report";
import type { QueueItem } from "@/db/growth-queries";

/**
 * Texten för ett köat meddelande (growth-1). Byggs alltid på servern ur
 * kön — aldrig ur ett formulärfält — så att en knapp inte kan skicka något
 * annat än det kön säger. När Cloud API finns (PR-17) blir samma text en
 * mall-parameter i stället för en wa.me-länk.
 */
export function queueMessageText(item: QueueItem): string {
  if (item.kind === "monthly_stats") {
    return monthlyStatsMessage({
      businessName: item.businessName,
      monthLabel: item.monthLabel ?? "el último mes",
      views: item.views,
      waClicks: item.waClicks,
      leads: item.leads ?? 0,
      panelUrl: absoluteUrl("/mi-sitio"),
    });
  }
  return renewalMessage({
    businessName: item.businessName,
    priceGs: item.priceGs ?? 0,
    views365: item.views,
    waClicks365: item.waClicks,
    siteUrl: absoluteUrl(`/${item.slug}`),
    reportUrl: absoluteUrl(reportPath(item.businessId, item.slug)),
  });
}

export function queueMessageHref(item: QueueItem): string {
  return waLink(item.whatsappPhone, queueMessageText(item));
}
