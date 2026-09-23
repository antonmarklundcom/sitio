import type { HoursInterval, HoursMap } from "./business";

export const PY_TIMEZONE = "America/Asuncion";

// Egen lista i stället för WEEKDAYS.map: business.ts importerar
// normalizeIntervals härifrån (R3-28), och en toppnivåläsning av WEEKDAYS
// skulle då krocka med importordningen. Samma ordning som WEEKDAYS.
const DAY_ORDER: string[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

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

/** Högst två pass per dag: mañana och tarde (siesta emellan). */
export const MAX_INTERVALS_PER_DAY = 2;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Städar en dags pass från ett formulär (R3-19): felformade och halvifyllda
 * pass faller bort, stängning "00:00" betyder midnatt (samma regel som
 * openState), passen sorteras, och pass som överlappar eller möts slås ihop
 * — 08:00–17:00 plus 14:00–19:00 är 08:00–19:00, inte två rader som säger
 * emot varandra. Tom lista = stängt.
 */
export function normalizeIntervals(raw: { open: string; close: string }[]): HoursInterval[] {
  const end = (close: string) => (close === "00:00" ? 24 * 60 : toMinutes(close));
  const valid = raw
    .map((i) => ({ open: i.open.trim(), close: i.close.trim() }))
    .filter((i) => TIME.test(i.open) && TIME.test(i.close) && end(i.close) > toMinutes(i.open))
    .sort((a, b) => toMinutes(a.open) - toMinutes(b.open));

  const out: HoursInterval[] = [];
  for (const interval of valid) {
    const last = out[out.length - 1];
    if (last && toMinutes(interval.open) <= end(last.close)) {
      if (end(interval.close) > end(last.close)) last.close = interval.close;
    } else {
      out.push({ ...interval });
    }
  }
  return out.slice(0, MAX_INTERVALS_PER_DAY);
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
        // 00:00–00:00 är dygnet runt; Google läser opens=closes=00:00 som
        // stängt hela dagen och vill ha 23:59 för en apotek-24h (R3-35).
        closes: interval.open === "00:00" && interval.close === "00:00" ? "23:59" : interval.close,
      });
    }
  }
  return spec.length > 0 ? spec : undefined;
}

/** "Abierto ahora · cierra 18:00" — samma mening överallt den visas. */
export function statusText(status: OpenState | null): string | null {
  if (!status) return null;
  if (status.open) return `Abierto ahora · cierra ${status.closesAt}`;
  if (status.opensAt) return `Cerrado · abre ${status.opensDay ? `${status.opensDay} ` : ""}${status.opensAt}`;
  return "Consultanos el horario por WhatsApp";
}
