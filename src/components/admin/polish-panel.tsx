"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FieldDiff, PolishUsage } from "@/lib/ai-polish";
import type { PolishState } from "@/app/admin/(dashboard)/sitios/polish-actions";
import { Badge, Card, Notice, SectionTitle } from "./ui";

/**
 * "Pulir textos" — plan.md §5.3. Svenska: superadmin-yta.
 *
 * Panelen kör aldrig något själv vid render. Knappen startar en server action,
 * förslaget ligger kvar i activity_log och diffas mot det sparade tills du
 * kryssar i fälten och skriver dem.
 *
 * Allt från `@/lib/ai-polish` importeras som TYPER. Den modulen drar in
 * Anthropic-SDK:n, och ett värde härifrån hade lagt hela SDK:n i
 * klientbundeln — diffen räknas därför på servern och kommer in som prop.
 */

/** Måste ordagrant matcha MISSING_KEY_MESSAGE i src/lib/ai-polish.ts. */
const MISSING_KEY_NOTICE = "ANTHROPIC_API_KEY saknas i miljön";

function SubmitButton({
  label,
  pendingLabel,
  disabled,
  tone = "accent",
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  tone?: "accent" | "plain";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === "accent"
          ? "bg-admin-accent text-white hover:opacity-90"
          : "border border-admin-line bg-admin-surface-2 text-admin-text hover:border-admin-muted"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function DiffColumn({ title, text, muted }: { title: string; text: string; muted?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-admin-muted">{title}</p>
      <pre
        className={`whitespace-pre-wrap break-words rounded-lg border border-admin-line bg-admin-surface-2 p-3 text-sm ${
          muted ? "text-admin-muted" : "text-admin-text"
        }`}
      >
        {text || "—"}
      </pre>
    </div>
  );
}

export function PolishPanel({
  hasApiKey,
  model,
  diffs,
  warnings,
  usage,
  proposedAt,
  aiPolishedAt,
  runPolish,
  applyPolish,
}: {
  hasApiKey: boolean;
  model: string;
  /** null = inget förslag finns ännu. */
  diffs: FieldDiff[] | null;
  warnings: string[];
  usage: PolishUsage | null;
  proposedAt: string | null;
  aiPolishedAt: string | null;
  runPolish: (state: PolishState, formData: FormData) => Promise<PolishState>;
  applyPolish: (state: PolishState, formData: FormData) => Promise<PolishState>;
}) {
  const [runState, runAction] = useActionState<PolishState, FormData>(runPolish, {});
  const [applyState, applyAction] = useActionState<PolishState, FormData>(applyPolish, {});

  const changed = diffs?.filter((d) => d.changed) ?? [];

  return (
    <Card>
      <SectionTitle hint="Kundens råtext går till Claude API och kommer tillbaka putsad. Ingenting skrivs förrän du kryssar i fälten och trycker Aplicera — råtexten skrivs aldrig över.">
        Pulir textos
      </SectionTitle>

      <div className="space-y-4" data-testid="polish-panel">
        <div className="flex flex-wrap items-center gap-2 text-sm text-admin-muted">
          <code className="text-xs">{model}</code>
          {aiPolishedAt ? (
            <Badge tone="ok">Putsad {new Date(aiPolishedAt).toLocaleDateString("sv-SE")}</Badge>
          ) : (
            <Badge>Aldrig putsad</Badge>
          )}
        </div>

        {hasApiKey ? null : (
          <Notice tone="warn">
            {MISSING_KEY_NOTICE}. Putsningen är avstängd tills nyckeln finns i .env.local — allt annat på
            sidan fungerar som vanligt.
          </Notice>
        )}

        {runState.error ? <Notice tone="danger">{runState.error}</Notice> : null}
        {runState.ok ? <Notice tone="ok">{runState.ok}</Notice> : null}
        {applyState.error ? <Notice tone="danger">{applyState.error}</Notice> : null}
        {applyState.ok ? <Notice tone="ok">{applyState.ok}</Notice> : null}

        <form action={runAction}>
          <SubmitButton
            label={diffs ? "Kör igen" : "Pulir textos"}
            pendingLabel="Putsar…"
            disabled={!hasApiKey}
          />
        </form>

        {diffs ? (
          <form action={applyAction} className="space-y-4 border-t border-admin-line pt-4">
            <p className="text-sm text-admin-muted">
              Förslag från {proposedAt ? new Date(proposedAt).toLocaleString("sv-SE") : "okänd tid"} —{" "}
              {changed.length} av {diffs.length} fält skiljer sig
              {usage ? ` (${usage.inputTokens} in / ${usage.outputTokens} ut tokens, ${usage.model})` : ""}.
            </p>

            {warnings.length > 0 ? (
              <Notice tone="warn">
                <ul className="list-disc space-y-0.5 pl-5">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}

            <ul className="space-y-5">
              {diffs.map((diff) => (
                <li key={diff.key}>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      name="field"
                      value={diff.key}
                      defaultChecked={diff.changed}
                      disabled={!diff.changed}
                      className="h-4 w-4 accent-[var(--admin-accent)]"
                    />
                    {diff.label}
                    {diff.changed ? null : <Badge>oförändrat</Badge>}
                  </label>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <DiffColumn title="Nu" text={diff.current} muted />
                    <DiffColumn title="Förslag" text={diff.proposed} />
                  </div>
                </li>
              ))}
            </ul>

            <SubmitButton
              label="Aplicera valda"
              pendingLabel="Skriver…"
              disabled={changed.length === 0}
              tone="plain"
            />
          </form>
        ) : null}
      </div>
    </Card>
  );
}
