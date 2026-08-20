"use client";

import { useId, useState } from "react";
import { WEEKDAYS, type HoursMap } from "@/lib/business";

const inputBase =
  "w-full rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2 text-sm text-admin-text outline-none placeholder:text-admin-muted/60 focus:border-admin-accent";

export function Field({
  label,
  name,
  hint,
  error,
  children,
  required,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm text-admin-muted">
        {label}
        {required ? <span className="text-admin-danger"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-admin-muted">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-admin-danger">{error}</p> : null}
    </div>
  );
}

export function TextInput({
  name,
  defaultValue,
  placeholder,
  type = "text",
  maxLength,
  required,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <input
      id={name}
      name={name}
      type={type}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
      className={inputBase}
    />
  );
}

export function TextArea({
  name,
  defaultValue,
  rows = 4,
  maxLength,
  placeholder,
}: {
  name: string;
  defaultValue?: string | null;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      id={name}
      name={name}
      rows={rows}
      maxLength={maxLength}
      placeholder={placeholder}
      defaultValue={defaultValue ?? ""}
      className={inputBase}
    />
  );
}

export function Select({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select id={name} name={name} defaultValue={defaultValue} className={inputBase}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type ServiceRow = { name: string; desc?: string };

export function ServicesEditor({ defaultValue }: { defaultValue: ServiceRow[] }) {
  const [rows, setRows] = useState<ServiceRow[]>(
    defaultValue.length > 0 ? defaultValue : [{ name: "", desc: "" }],
  );

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-admin-line bg-admin-surface-2 p-3 sm:flex-row">
          <input
            name="service.name"
            defaultValue={row.name}
            placeholder="Instalaciones eléctricas"
            maxLength={80}
            className="w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2 text-sm outline-none focus:border-admin-accent sm:w-1/3"
          />
          <input
            name="service.desc"
            defaultValue={row.desc ?? ""}
            placeholder="Kort beskrivning (visas under rubriken)"
            maxLength={200}
            className="w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2 text-sm outline-none focus:border-admin-accent"
          />
          <button
            type="button"
            onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
            className="shrink-0 rounded-md border border-admin-line px-3 py-2 text-sm text-admin-muted hover:border-admin-danger hover:text-admin-danger"
            aria-label={`Ta bort tjänst ${i + 1}`}
          >
            Ta bort
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { name: "", desc: "" }])}
        className="rounded-lg border border-dashed border-admin-line px-3 py-2 text-sm text-admin-muted hover:border-admin-accent hover:text-admin-text"
      >
        + Lägg till tjänst
      </button>
    </div>
  );
}

export function HoursEditor({ defaultValue }: { defaultValue: HoursMap }) {
  const groupId = useId();

  return (
    <div className="space-y-2">
      {WEEKDAYS.map(({ key, label, short }) => {
        const intervals = defaultValue[key];
        const closed = intervals === null || intervals === undefined;
        return (
          <HoursRow
            key={key}
            dayKey={key}
            label={label}
            short={short}
            closed={closed}
            intervals={intervals ?? []}
            groupId={groupId}
          />
        );
      })}
      <p className="text-xs text-admin-muted">
        Två intervall per dag stöds — för almuerzo + cena. Lämna tomt för att bara använda det första.
      </p>
    </div>
  );
}

function HoursRow({
  dayKey,
  label,
  short,
  closed: initialClosed,
  intervals,
  groupId,
}: {
  dayKey: string;
  label: string;
  short: string;
  closed: boolean;
  intervals: { open: string; close: string }[];
  groupId: string;
}) {
  const [closed, setClosed] = useState(initialClosed);
  const timeClass =
    "rounded-md border border-admin-line bg-admin-surface px-2 py-1.5 text-sm outline-none focus:border-admin-accent disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2">
      <span className="w-24 text-sm text-admin-text">
        {label} <span className="text-admin-muted">({short})</span>
      </span>

      <label className="flex items-center gap-1.5 text-sm text-admin-muted">
        <input
          type="checkbox"
          name={`hours.${dayKey}.closed`}
          defaultChecked={initialClosed}
          onChange={(e) => setClosed(e.currentTarget.checked)}
          className="accent-admin-accent"
          id={`${groupId}-${dayKey}-closed`}
        />
        Cerrado
      </label>

      {[0, 1].map((i) => (
        <span key={i} className="flex items-center gap-1">
          <input
            type="time"
            name={`hours.${dayKey}.${i}.open`}
            defaultValue={intervals[i]?.open ?? ""}
            disabled={closed}
            className={timeClass}
            aria-label={`${label} intervall ${i + 1} öppnar`}
          />
          <span className="text-admin-muted">–</span>
          <input
            type="time"
            name={`hours.${dayKey}.${i}.close`}
            defaultValue={intervals[i]?.close ?? ""}
            disabled={closed}
            className={timeClass}
            aria-label={`${label} intervall ${i + 1} stänger`}
          />
        </span>
      ))}
    </div>
  );
}
