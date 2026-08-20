"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PLANS,
  PLAN_LABELS,
  PLAN_SUGGESTED_PRICE_GS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  daysUntil,
  type SubscriptionStatus,
} from "@/lib/billing";
import { formatGs } from "@/lib/format";
import type { BillingFormState } from "@/app/admin/(dashboard)/pagos/actions";
import { Card, Notice, SectionTitle } from "./ui";
import { Field, Select, TextArea, TextInput } from "./fields";

/**
 * Prenumeration + betalningar för EN sajt. Svenska: superadmin-UI.
 *
 * Två separata formulär med flit. Att registrera en betalning och att bekräfta
 * den är två beslut: det första skriver ner vad kunden säger, det andra
 * förlänger prenumerationen. Slås de ihop förlänger ett slarvigt klick ett år.
 */
export type SubscriptionView = {
  id: number;
  plan: string;
  priceGs: number;
  startsAt: string;
  expiresAt: string;
  status: string;
} | null;

export type PaymentView = {
  id: number;
  amountGs: number;
  method: string;
  reference: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  confirmedAt: string | null;
  notes: string | null;
  receiptUrl: string | null;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Sparar…" : label}
    </button>
  );
}

function statusTone(status: string): "ok" | "warn" | "danger" | "neutral" {
  if (status === "active" || status === "confirmed") return "ok";
  if (status === "trial" || status === "grace" || status === "reported") return "warn";
  if (status === "expired" || status === "rejected") return "danger";
  return "neutral";
}

export function BillingPanel({
  businessId,
  businessName,
  subscription,
  payments,
  renewalHref,
  yearStats,
  saveSubscription,
  registerPayment,
  confirmPayment,
  rejectPayment,
  today,
  defaultExpiry,
}: {
  businessId: number;
  businessName: string;
  subscription: SubscriptionView;
  payments: PaymentView[];
  renewalHref: string;
  yearStats: { views365: number; waClicks365: number };
  saveSubscription: (state: BillingFormState, formData: FormData) => Promise<BillingFormState>;
  registerPayment: (state: BillingFormState, formData: FormData) => Promise<BillingFormState>;
  confirmPayment: (formData: FormData) => Promise<void>;
  rejectPayment: (formData: FormData) => Promise<void>;
  /** Dagens datum som YYYY-MM-DD, beräknat på servern så klienten inte gissar. */
  today: string;
  defaultExpiry: string;
}) {
  const [subState, subAction] = useActionState<BillingFormState, FormData>(saveSubscription, {});
  const [payState, payAction] = useActionState<BillingFormState, FormData>(registerPayment, {});

  const left = subscription ? daysUntil(subscription.expiresAt, today) : null;
  const back = `/admin/sitios/${businessId}`;

  return (
    <Card>
      <SectionTitle hint="Priser i heltals-guaraníes. Bekräftad betalning förlänger perioden; utebliven betalning pausar sajten efter respiten.">
        Prenumeration och betalningar
      </SectionTitle>

      {subscription ? (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-admin-line bg-admin-surface-2 px-4 py-3 text-sm">
          <span className="font-medium">{PLAN_LABELS[subscription.plan as keyof typeof PLAN_LABELS] ?? subscription.plan}</span>
          <span className="font-mono">{formatGs(subscription.priceGs)}/år</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${
              statusTone(subscription.status) === "ok"
                ? "border-admin-ok/40 bg-admin-ok/10 text-admin-ok"
                : statusTone(subscription.status) === "warn"
                  ? "border-admin-warn/40 bg-admin-warn/10 text-admin-warn"
                  : statusTone(subscription.status) === "danger"
                    ? "border-admin-danger/40 bg-admin-danger/10 text-admin-danger"
                    : "border-admin-line text-admin-muted"
            }`}
          >
            {SUBSCRIPTION_STATUS_LABELS[subscription.status as SubscriptionStatus] ?? subscription.status}
          </span>
          <span className="text-admin-muted">
            Förfaller {subscription.expiresAt}
            {left !== null ? (left >= 0 ? ` · om ${left} dgr` : ` · ${Math.abs(left)} dgr sedan`) : ""}
          </span>
          <a
            href={renewalHref}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-admin-accent hover:underline"
            title={`Förnyelsemeddelande med årets statistik: ${yearStats.views365} besök, ${yearStats.waClicks365} WhatsApp-klick`}
          >
            Skicka förnyelse på WhatsApp →
          </a>
        </div>
      ) : (
        <Notice tone="warn">
          {businessName} har ingen prenumeration. Skapa en innan du registrerar en betalning.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={subAction} className="space-y-3">
          <h3 className="text-sm font-medium">{subscription ? "Uppdatera prenumeration" : "Skapa prenumeration"}</h3>
          {subState.error ? <Notice tone="danger">{subState.error}</Notice> : null}
          {subState.ok ? <Notice tone="ok">{subState.ok}</Notice> : null}
          {subscription ? <input type="hidden" name="subscriptionId" value={subscription.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plan" name="plan" error={subState.fieldErrors?.plan}>
              <Select
                name="plan"
                defaultValue={subscription?.plan ?? "basico"}
                options={PLANS.map((p) => ({
                  value: p,
                  label: `${PLAN_LABELS[p]} — riktpris ${formatGs(PLAN_SUGGESTED_PRICE_GS[p])}`,
                }))}
              />
            </Field>
            <Field label="Pris per år (Gs)" name="priceGs" required error={subState.fieldErrors?.priceGs}>
              <TextInput
                name="priceGs"
                type="number"
                defaultValue={String(subscription?.priceGs ?? PLAN_SUGGESTED_PRICE_GS.basico)}
                required
              />
            </Field>
            <Field label="Startar" name="startsAt" required error={subState.fieldErrors?.startsAt}>
              <TextInput name="startsAt" type="date" defaultValue={subscription?.startsAt ?? today} required />
            </Field>
            <Field label="Förfaller" name="expiresAt" required error={subState.fieldErrors?.expiresAt}>
              <TextInput
                name="expiresAt"
                type="date"
                defaultValue={subscription?.expiresAt ?? defaultExpiry}
                required
              />
            </Field>
            <Field label="Status" name="status" error={subState.fieldErrors?.status}>
              <Select
                name="status"
                defaultValue={subscription?.status ?? "active"}
                options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: SUBSCRIPTION_STATUS_LABELS[s] }))}
              />
            </Field>
          </div>
          <SubmitButton label="Spara prenumeration" />
        </form>

        <form action={payAction} className="space-y-3">
          <h3 className="text-sm font-medium">Registrera betalning</h3>
          {payState.error ? <Notice tone="danger">{payState.error}</Notice> : null}
          {payState.ok ? <Notice tone="ok">{payState.ok}</Notice> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Belopp (Gs)" name="amountGs" required error={payState.fieldErrors?.amountGs}>
              <TextInput
                name="amountGs"
                type="number"
                defaultValue={String(subscription?.priceGs ?? "")}
                required
              />
            </Field>
            <Field label="Metod" name="method" error={payState.fieldErrors?.method}>
              <Select
                name="method"
                defaultValue="transferencia"
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
              />
            </Field>
            <Field label="Referens (nro de operación)" name="reference" error={payState.fieldErrors?.reference}>
              <TextInput name="reference" maxLength={120} />
            </Field>
            <Field label="Kvitto (comprobante)" name="receipt" error={payState.fieldErrors?.receipt}>
              <input
                id="receipt"
                name="receipt"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="w-full rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-admin-surface file:px-2 file:py-1 file:text-admin-text"
              />
            </Field>
            <Field label="Period från" name="periodStart" required error={payState.fieldErrors?.periodStart}>
              <TextInput name="periodStart" type="date" defaultValue={subscription?.startsAt ?? today} required />
            </Field>
            <Field label="Period till" name="periodEnd" required error={payState.fieldErrors?.periodEnd}>
              <TextInput name="periodEnd" type="date" defaultValue={subscription?.expiresAt ?? defaultExpiry} required />
            </Field>
          </div>
          <Field label="Anteckning" name="notes" error={payState.fieldErrors?.notes}>
            <TextArea name="notes" rows={2} maxLength={300} />
          </Field>
          <SubmitButton label="Registrera betalning" />
        </form>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium">Betalningshistorik</h3>
        {payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-admin-line px-3 py-5 text-center text-sm text-admin-muted">
            Inga betalningar registrerade.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-line">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-admin-line bg-admin-surface-2 text-left text-xs tracking-wide text-admin-muted uppercase">
                  <th className="px-3 py-2 font-medium">Belopp</th>
                  <th className="px-3 py-2 font-medium">Metod</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Kvitto</th>
                  <th className="px-3 py-2 text-right font-medium">Åtgärd</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-admin-line last:border-0">
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{formatGs(p.amountGs)}</td>
                    <td className="px-3 py-2">
                      {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}
                      {p.reference ? <span className="block text-xs text-admin-muted">{p.reference}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-admin-muted">
                      {p.periodStart} → {p.periodEnd}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          statusTone(p.status) === "ok"
                            ? "border-admin-ok/40 bg-admin-ok/10 text-admin-ok"
                            : statusTone(p.status) === "warn"
                              ? "border-admin-warn/40 bg-admin-warn/10 text-admin-warn"
                              : "border-admin-danger/40 bg-admin-danger/10 text-admin-danger"
                        }`}
                      >
                        {p.status === "reported" ? "Rapporterad" : p.status === "confirmed" ? "Bekräftad" : "Avvisad"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {p.receiptUrl ? (
                        <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-admin-accent hover:underline">
                          Visa
                        </a>
                      ) : (
                        <span className="text-admin-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.status === "reported" ? (
                        <span className="inline-flex gap-2">
                          <form action={confirmPayment}>
                            <input type="hidden" name="paymentId" value={p.id} />
                            <input type="hidden" name="back" value={back} />
                            <button type="submit" className="rounded-md bg-admin-ok px-2.5 py-1.5 text-xs font-medium text-admin-bg">
                              Bekräfta
                            </button>
                          </form>
                          <form action={rejectPayment}>
                            <input type="hidden" name="paymentId" value={p.id} />
                            <input type="hidden" name="back" value={back} />
                            <button
                              type="submit"
                              className="rounded-md border border-admin-line px-2.5 py-1.5 text-xs text-admin-muted hover:text-admin-danger"
                            >
                              Avvisa
                            </button>
                          </form>
                        </span>
                      ) : (
                        <span className="text-xs text-admin-muted">
                          {p.confirmedAt ? `Bekräftad ${p.confirmedAt}` : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
