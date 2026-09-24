import Link from "next/link";
import { listMessageQueue, listRecentMessages } from "@/db/growth-queries";
import { requireRole } from "@/lib/auth";
import { formatGs } from "@/lib/format";
import { MESSAGE_KIND_LABELS } from "@/lib/growth";
import { queueMessageHref, queueMessageText } from "@/lib/message-queue";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/admin/ui";
import { markMessageSentAction } from "./actions";
import { SendButton } from "./send-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mensajes" };

/**
 * Meddelandekön (growth-1, idé 4 + 5): förnyelsepåminnelser 30/15/7 dagar
 * och förra månadens siffror, klara att skicka med ett tryck. Tills Cloud
 * API finns (PR-17) skickar du dem själv via wa.me; kön minns vad som gått.
 */
export default async function MensajesPage() {
  await requireRole("superadmin");
  const [queue, recent] = await Promise.all([listMessageQueue(), listRecentMessages()]);
  const renewals = queue.filter((q) => q.kind !== "monthly_stats");
  const monthly = queue.filter((q) => q.kind === "monthly_stats");

  const section = (title: string, hint: string, items: typeof queue) => (
    <Card>
      <SectionTitle hint={hint}>{title}</SectionTitle>
      {items.length === 0 ? (
        <EmptyState title="Nada pendiente." />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.businessId}-${item.kind}-${item.periodKey}`} className="rounded-lg border border-admin-line p-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link href={`/admin/sitios/${item.businessId}`} className="font-medium hover:text-admin-accent">
                  {item.businessName}
                </Link>
                <Badge tone={item.kind === "renewal_overdue" || item.kind === "renewal_7" ? "danger" : item.kind === "monthly_stats" ? "ok" : "warn"}>
                  {MESSAGE_KIND_LABELS[item.kind]}
                </Badge>
                {item.daysLeft !== undefined ? (
                  <span className="text-xs text-admin-muted">
                    {item.daysLeft >= 0 ? `vence en ${item.daysLeft} días` : `vencido hace ${Math.abs(item.daysLeft)} días`} · {formatGs(item.priceGs ?? 0)}
                  </span>
                ) : null}
                <span className="font-mono text-xs text-admin-muted">
                  {item.views} visitas / {item.waClicks} WA{item.leads ? ` / ${item.leads} consultas` : ""}
                </span>
              </div>
              <p className="mt-2 text-sm text-admin-muted">{queueMessageText(item)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <form action={markMessageSentAction}>
                  <input type="hidden" name="businessId" value={item.businessId} />
                  <input type="hidden" name="kind" value={item.kind} />
                  <input type="hidden" name="periodKey" value={item.periodKey} />
                  <SendButton href={queueMessageHref(item)} />
                </form>
                <form action={markMessageSentAction}>
                  <input type="hidden" name="businessId" value={item.businessId} />
                  <input type="hidden" name="kind" value={item.kind} />
                  <input type="hidden" name="periodKey" value={item.periodKey} />
                  <input type="hidden" name="skip" value="1" />
                  <button type="submit" className="rounded-md border border-admin-line px-2.5 py-1.5 text-xs text-admin-muted hover:text-admin-text">
                    Omitir
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Mensajes</h1>
        <p className="mt-1 text-sm text-admin-muted">
          {queue.length} mensajes para hoy. “Enviar por WhatsApp” abre el chat con el texto listo y lo marca como enviado.
          Cuando esté la API de WhatsApp (PR-17), esta cola se envía sola.
        </p>
      </div>
      {section(
        "Renovaciones",
        "Recordatorios a 30, 15 y 7 días del vencimiento, y a los vencidos. Cada etapa sale una sola vez por período, con las cifras del año y el enlace a “tu año en cifras”.",
        renewals,
      )}
      {section(
        "Cifras del mes",
        "Un mensaje por sitio publicado con visitas el mes pasado. Que el cliente vea el valor todos los meses es lo que hace fácil la renovación.",
        monthly,
      )}
      <Card>
        <SectionTitle>Enviados recientemente</SectionTitle>
        {recent.length === 0 ? (
          <EmptyState title="Todavía no se envió nada." />
        ) : (
          <ul className="space-y-1 text-sm">
            {recent.map((m) => (
              <li key={m.id} className="flex flex-wrap gap-x-3">
                <span className="font-mono text-xs text-admin-muted">{new Date(m.sentAt).toISOString().slice(0, 16).replace("T", " ")}</span>
                <span>{m.businessName}</span>
                <span className="text-admin-muted">{MESSAGE_KIND_LABELS[m.kind] ?? m.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
