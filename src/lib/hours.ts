import { WEEKDAYS, type HoursInterval, type HoursMap } from "./business";

export const PY_TIMEZONE = "America/Asuncion";

const DAY_ORDER: string[] = WEEKDAYS.map((d) => d.key);

/** JS getDay() är 0=söndag; våra nycklar börjar på måndag. */
const JS_DAY_TO_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export const DAY_LABELS_ES: Record<string, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

/**
 * Lokal tid i Asunción. Paraguay avskaffade sommartid 2024 och ligger på
 * UTC-3, men offseten hämtas via Intl i stället för att hårdkodas — det är
 * exakt den sortens antagande som går sönder tyst om regeln ändras igen.
 */
export function nowInAsuncion(now: Date = new Date()): { dayKey: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PY_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, string> = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };

  const dayKey = weekdayMap[get("weekday")] ?? JS_DAY_TO_KEY[now.getUTCDay()];
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));

  return { dayKey, minutes: hour * 60 + minute };
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export type OpenState =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string; opensDay: string | null };

/**
 * "Abierto ahora"-logik. Ett intervall som slutar 00:00 tolkas som midnatt
 * samma dygn — gastronomía skriver ofta 19:00–00:00.
 */
export function openState(hours: HoursMap | null | undefined, now: Date = new Date()): OpenState | null {
  if (!hours || Object.keys(hours).length === 0) return null;

  const { dayKey, minutes } = nowInAsuncion(now);
  const today = hours[dayKey] ?? null;

  if (today) {
    for (const interval of today) {
      const start = toMinutes(interval.open);
      const end = interval.close === "00:00" ? 24 * 60 : toMinutes(interval.close);
      if (minutes >= start && minutes < end) return { open: true, closesAt: interval.close };
    }

    const next = today.find((i) => toMinutes(i.open) > minutes);
    if (next) return { open: false, opensAt: next.open, opensDay: null };
  }

  // Leta framåt upp till sju dagar efter nästa öppna dag.
  const startIndex = DAY_ORDER.indexOf(dayKey);
  for (let step = 1; step <= 7; step += 1) {
    const key = DAY_ORDER[(startIndex + step) % 7];
    const intervals = hours[key];
    if (intervals && intervals.length > 0) {
      return { open: false, opensAt: intervals[0].open, opensDay: DAY_LABELS_ES[key] ?? key };
    }
  }

  return { open: false, opensAt: "", opensDay: null };
}

/** Sammanslagen visningslista: intilliggande dagar med samma tider slås ihop. */
export function groupedHours(hours: HoursMap | null | undefined): { days: string; intervals: HoursInterval[] | null }[] {
  if (!hours) return [];

  const rows: { keys: string[]; intervals: HoursInterval[] | null }[] = [];
  const signature = (intervals: HoursInterval[] | null) =>
    intervals ? intervals.map((i) => `${i.open}-${i.close}`).join("|") : "closed";

  for (const key of DAY_ORDER) {
    const intervals = hours[key] ?? null;
    const last = rows[rows.length - 1];
    if (last && signature(last.intervals) === signature(intervals)) {
      last.keys.push(key);
    } else {
      rows.push({ keys: [key], intervals });
    }
  }

  return rows.map((row) => ({
    days:
      row.keys.length === 1
        ? DAY_LABELS_ES[row.keys[0]]
        : `${DAY_LABELS_ES[row.keys[0]]} – ${DAY_LABELS_ES[row.keys[row.keys.length - 1]]}`,
    intervals: row.intervals,
  }));
}

/** openingHoursSpecification för LocalBusiness-schemat. */
export function openingHoursSpecification(hours: HoursMap | null | undefined) {
  if (!hours) return undefined;

  const SCHEMA_DAY: Record<string, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };

  const spec: { "@type": string; dayOfWeek: string; opens: string; closes: string }[] = [];
  for (const key of DAY_ORDER) {
    for (const interval of hours[key] ?? []) {
      spec.push({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: SCHEMA_DAY[key],
        opens: interval.open,
        closes: interval.close,
      });
    }
  }
  return spec.length > 0 ? spec : undefined;
}
