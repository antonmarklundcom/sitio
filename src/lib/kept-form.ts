/**
 * Formulär som behåller det kunden skrev när servern säger nej (R3-38).
 *
 * React 19 återställer ett `<form action>` efter varje åtgärd — även när den
 * returnerar ett fel — till fältens defaultValue, alltså det som ligger i
 * databasen. En kund som skrivit en beskrivning på telefonen och fick "mínimo
 * 80 caracteres" förlorade allt. Omslaget här lägger det inskickade
 * FormData-objektet i state vid fel, och formuläret läser sina defaultValue
 * därifrån: återställningen landar då på det kunden skrev.
 *
 * Klientsäker. FormData:n stannar i webbläsaren — den skickas inte tillbaka
 * till servern med nästa anrop.
 */
export type KeptState = { submitted?: FormData };

export function keepSubmittedOnError<S extends { error?: string }>(
  action: (state: S, formData: FormData) => Promise<S>,
): (state: S & KeptState, formData: FormData) => Promise<S & KeptState> {
  return async (prev, formData) => {
    const { submitted: _drop, ...rest } = prev;
    void _drop;
    const result = await action(rest as S, formData);
    return result.error ? { ...result, submitted: formData } : result;
  };
}

/** Ett textfält ur det inskickade formuläret, eller fallback när inget skickats. */
export function kept(submitted: FormData | undefined, name: string, fallback: string): string {
  if (!submitted) return fallback;
  const v = submitted.get(name);
  return typeof v === "string" ? v : fallback;
}

/** Tjänsteraderna som de skrevs, tomma rader kvar på sin plats. */
export function keptServices(
  submitted: FormData,
  count: number,
): { name: string; desc?: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    name: String(submitted.get(`service.${i}.name`) ?? ""),
    desc: String(submitted.get(`service.${i}.desc`) ?? ""),
  }));
}

/**
 * Öppettiderna som de skrevs (inte städade — kunden ska se sina egna tider).
 * `slotName(day, slot, "open")` ger fältnamnet; intaken och ägarpanelen
 * namnger första passet olika.
 */
export function keptHours(
  submitted: FormData,
  slotName: (day: string, slot: number, edge: "open" | "close") => string,
): Record<string, { open: string; close: string }[] | null> {
  const out: Record<string, { open: string; close: string }[] | null> = {};
  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
    if (submitted.get(`hours.${day}.closed`) === "on") {
      out[day] = null;
      continue;
    }
    const intervals = [0, 1]
      .map((slot) => ({
        open: String(submitted.get(slotName(day, slot, "open")) ?? ""),
        close: String(submitted.get(slotName(day, slot, "close")) ?? ""),
      }))
      .filter((i) => i.open || i.close);
    out[day] = intervals.length > 0 ? intervals : null;
  }
  return out;
}
