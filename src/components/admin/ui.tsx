import Link from "next/link";
import type { BusinessStatus } from "@/lib/business";
import { STATUS_LABELS } from "@/lib/business";

const STATUS_TONE: Record<BusinessStatus, string> = {
  draft: "border-admin-line bg-admin-surface-2 text-admin-muted",
  pending_review: "border-admin-warn/40 bg-admin-warn/10 text-admin-warn",
  published: "border-admin-ok/40 bg-admin-ok/10 text-admin-ok",
  paused: "border-admin-danger/40 bg-admin-danger/10 text-admin-danger",
  archived: "border-admin-line bg-transparent text-admin-muted",
};

export function StatusBadge({ status }: { status: BusinessStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger";
  title?: string;
}) {
  const tones = {
    neutral: "border-admin-line bg-admin-surface-2 text-admin-muted",
    ok: "border-admin-ok/40 bg-admin-ok/10 text-admin-ok",
    warn: "border-admin-warn/40 bg-admin-warn/10 text-admin-warn",
    danger: "border-admin-danger/40 bg-admin-danger/10 text-admin-danger",
  };
  return (
    <span title={title} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-admin-line bg-admin-surface p-5 ${className}`}>{children}</section>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold tracking-wide text-admin-text uppercase">{children}</h2>
      {hint ? <p className="mt-1 text-sm text-admin-muted">{hint}</p> : null}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "secondary",
  target,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  target?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-admin-accent text-white hover:opacity-90"
      : "border border-admin-line bg-admin-surface-2 text-admin-text hover:border-admin-muted";
  return (
    <Link
      href={href}
      target={target}
      rel={target === "_blank" ? "noreferrer" : undefined}
      className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${styles}`}
    >
      {children}
    </Link>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "warn" | "danger"; children: React.ReactNode }) {
  const tones = {
    ok: "border-admin-ok/40 bg-admin-ok/10 text-admin-ok",
    warn: "border-admin-warn/40 bg-admin-warn/10 text-admin-warn",
    danger: "border-admin-danger/40 bg-admin-danger/10 text-admin-danger",
  };
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-admin-line px-6 py-12 text-center">
      <p className="text-admin-text">{title}</p>
      {children ? <div className="mt-3 text-sm text-admin-muted">{children}</div> : null}
    </div>
  );
}
