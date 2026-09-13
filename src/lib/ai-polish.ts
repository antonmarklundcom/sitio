/**
 * AI-puts ("Pulir textos") — plan.md §5.3, docs/PLAN.md §1.4 och D7.
 *
 * Kundens råtext går in, publicerbar copy kommer ut. Allt här är rena
 * funktioner utom `polishBusiness()`, som gör det enda API-anropet. Ingen
 * databasåtkomst: skrivningen och loggen ligger i polish-actions.ts, så den
 * här filen går att enhetstesta utan MySQL.
 *
 * Anropet sker ALDRIG vid render eller i en ISR-väg — bara från en server
 * action som superadmin startar med ett knapptryck (plan.md §1.5).
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORY_LABELS, type HoursMap } from "./business";
import { env } from "./env";
import { groupedHours } from "./hours";

/** Visas i panelen och som actionfel när nyckeln inte finns i miljön. */
export const MISSING_KEY_MESSAGE = "ANTHROPIC_API_KEY saknas i miljön";

/**
 * Gränserna kommer från plan.md §5.3.1. De är snävare än databasens kolumner
 * (seo_title varchar(70), seo_description varchar(160)) med flit: schemamoden
 * i API:t garanterar formen på svaret, aldrig längden, så vi klampar själva.
 */
export const POLISH_LIMITS = {
  descriptionMinWords: 80,
  descriptionMaxWords: 160,
  /** description är en TEXT-kolumn; taket är formulärets egen gräns. */
  descriptionMaxChars: 2000,
  seoTitleMaxChars: 60,
  seoDescriptionMaxChars: 155,
  serviceDescMaxChars: 140,
} as const;

/**
 * Yttre hinder innan vi kastar hela svaret. Ett fält som är en aning för långt
 * klamper vi vid ordgränsen; ett som är dubbelt för långt betyder att modellen
 * struntat i instruktionen, och då är en trunkering bara ett annat sätt att
 * publicera skräp.
 */
const HARD_REJECT_FACTOR = 2;
const DESCRIPTION_ABSURD_MIN_WORDS = 40;
const DESCRIPTION_ABSURD_MAX_WORDS = 240;

const MAX_TOKENS = 4000;

// ---------- indata ----------

export type PolishBusiness = {
  name: string;
  category: string;
  city: string | null;
  zone: string | null;
  rawDescription: string | null;
  description: string | null;
  servicesJson: unknown;
  hoursJson: HoursMap | null;
};

export type PolishInput = {
  name: string;
  category: string;
  categoryLabel: string;
  city: string;
  zone: string;
  rawDescription: string;
  services: { name: string; desc: string }[];
  hoursSummary: string;
};

function asServices(value: unknown): { name: string; desc: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is { name: string; desc?: string } => Boolean(s) && typeof s === "object" && "name" in s)
    .map((s) => ({ name: String(s.name ?? "").trim(), desc: String(s.desc ?? "").trim() }))
    .filter((s) => s.name.length > 0);
}

/** Sammanfattar öppettiderna på en rad per dagsgrupp — modellen ska kunna nämna dem. */
export function hoursSummary(hours: HoursMap | null | undefined): string {
  const rows = groupedHours(hours);
  if (rows.length === 0) return "sin horario cargado";
  return rows
    .map((row) =>
      row.intervals && row.intervals.length > 0
        ? `${row.days}: ${row.intervals.map((i) => `${i.open}–${i.close}`).join(", ")}`
        : `${row.days}: cerrado`,
    )
    .join("; ");
}

/**
 * Plockar ut exakt det modellen får se. Kundens råtext är förstahandskällan;
 * saknas den används den redan sparade `description` som underlag, annars har
 * vi inget att putsa.
 */
export function buildPolishInput(business: PolishBusiness): PolishInput {
  const category = business.category;
  return {
    name: business.name.trim(),
    category,
    categoryLabel: CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category,
    city: (business.city ?? "").trim(),
    zone: (business.zone ?? "").trim(),
    rawDescription: (business.rawDescription ?? business.description ?? "").trim(),
    services: asServices(business.servicesJson),
    hoursSummary: hoursSummary(business.hoursJson),
  };
}

/** Kravet på indata innan vi bränner ett API-anrop. */
export function polishInputBlockers(input: PolishInput): string[] {
  const blockers: string[] = [];
  if (input.rawDescription.length < 20) blockers.push("Kundens råtext är för kort (minst 20 tecken).");
  if (input.services.length === 0) blockers.push("Sajten har inga tjänster att beskriva.");
  if (!input.city) blockers.push("Staden saknas — seo-titeln ska sluta med den.");
  return blockers;
}

export const SYSTEM_PROMPT = [
  "Sos redactor de textos comerciales para sitios web de pequeños negocios en Paraguay.",
  "Escribís en español paraguayo con voseo (vos, tenés, escribinos), natural y directo, nunca neutro ni peninsular.",
  "",
  "Reglas duras:",
  "- Nunca inventes datos. Usá solamente lo que está en la ficha: si no figura un precio, un año de fundación, una certificación, una cantidad de clientes o una cobertura, no lo menciones.",
  "- Nada de superlativos que afirmen algo: prohibido 'el mejor', 'el número uno', 'garantizado', 'el más barato', 'líder'.",
  "- Si el rubro es salud o belleza, no prometas resultados, curaciones ni efectos terapéuticos, y no des consejo médico.",
  "- Escribí sobre el negocio, no sobre el sitio web. Nada de 'bienvenido a nuestra página'.",
  "- Cerrá invitando a escribir por WhatsApp, sin poner ningún número.",
  "",
  "Formato exigido:",
  `- description: ${POLISH_LIMITS.descriptionMinWords}–${POLISH_LIMITS.descriptionMaxWords} palabras, en 2 o 3 párrafos separados por un salto de línea, texto plano sin markdown.`,
  `- seoTitle: máximo ${POLISH_LIMITS.seoTitleMaxChars} caracteres y TERMINA con la ciudad del negocio.`,
  `- seoDescription: máximo ${POLISH_LIMITS.seoDescriptionMaxChars} caracteres, una sola frase que invite a contactar.`,
  `- services: exactamente los mismos servicios de la ficha, en el mismo orden y con el mismo nombre; solo escribís el campo desc, máximo ${POLISH_LIMITS.serviceDescMaxChars} caracteres cada uno.`,
].join("\n");

/** Användarmeddelandet. Enhetstestet läser det här och kräver varje fält. */
export function renderUserPrompt(input: PolishInput): string {
  return [
    "Ficha del negocio:",
    `- nombre: ${input.name}`,
    `- rubro: ${input.category} (${input.categoryLabel})`,
    `- ciudad: ${input.city || "sin dato"}`,
    `- zona/barrio: ${input.zone || "sin dato"}`,
    `- horarios: ${input.hoursSummary}`,
    `- servicios (${input.services.length}):`,
    ...input.services.map((s, i) => `  ${i + 1}. ${s.name}${s.desc ? ` — texto actual: ${s.desc}` : ""}`),
    "",
    "Texto crudo del cliente (fuente única de los hechos):",
    input.rawDescription,
    "",
    "Reescribilo siguiendo las reglas del sistema.",
  ].join("\n");
}

// ---------- svar ----------

export const polishResponseSchema = z.object({
  description: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  services: z.array(z.object({ name: z.string(), desc: z.string() })),
});

export type PolishResult = {
  description: string;
  seoTitle: string;
  seoDescription: string;
  services: { name: string; desc: string }[];
};

export type PolishUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

export type PolishValidation =
  | { ok: true; value: PolishResult; warnings: string[] }
  | { ok: false; error: string };

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Trunkerar vid närmaste ordgräns under taket. Lägger inte till ellips. */
export function clampText(text: string, max: number): string {
  const value = text.trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd().replace(/[.,;:—-]$/, "");
}

/**
 * Sista spärren mellan modellen och databasen. Schemamoden ger oss formen;
 * längden, tjänsteantalet och namnen måste vi äga själva.
 *
 * Tjänstenamnen tas ALLTID från indata: modellen får skriva `desc`, aldrig
 * döpa om eller hitta på en tjänst.
 */
export function validateProposal(input: PolishInput, raw: unknown): PolishValidation {
  const parsed = polishResponseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Modellen svarade i fel format. Försök igen." };

  const proposed = parsed.data;
  const warnings: string[] = [];

  if (proposed.services.length !== input.services.length) {
    return {
      ok: false,
      error: `Modellen returnerade ${proposed.services.length} tjänster men sajten har ${input.services.length}. Förslaget slängdes.`,
    };
  }

  const description = proposed.description.trim();
  const words = wordCount(description);
  if (description.length === 0) return { ok: false, error: "Modellen lämnade beskrivningen tom." };
  if (words < DESCRIPTION_ABSURD_MIN_WORDS || words > DESCRIPTION_ABSURD_MAX_WORDS) {
    return {
      ok: false,
      error: `Beskrivningen blev ${words} ord (kravet är ${POLISH_LIMITS.descriptionMinWords}–${POLISH_LIMITS.descriptionMaxWords}). Förslaget slängdes.`,
    };
  }
  if (description.length > POLISH_LIMITS.descriptionMaxChars) {
    return { ok: false, error: "Beskrivningen är längre än fältet rymmer. Förslaget slängdes." };
  }
  if (words < POLISH_LIMITS.descriptionMinWords || words > POLISH_LIMITS.descriptionMaxWords) {
    warnings.push(`Beskrivningen blev ${words} ord, utanför ${POLISH_LIMITS.descriptionMinWords}–${POLISH_LIMITS.descriptionMaxWords}.`);
  }

  const seoTitle = proposed.seoTitle.trim();
  const seoDescription = proposed.seoDescription.trim();
  if (!seoTitle || !seoDescription) return { ok: false, error: "Modellen lämnade ett seo-fält tomt." };

  const overLong = (value: string, max: number) => value.length > max * HARD_REJECT_FACTOR;
  if (
    overLong(seoTitle, POLISH_LIMITS.seoTitleMaxChars) ||
    overLong(seoDescription, POLISH_LIMITS.seoDescriptionMaxChars) ||
    proposed.services.some((s) => overLong(s.desc.trim(), POLISH_LIMITS.serviceDescMaxChars))
  ) {
    return { ok: false, error: "Ett eller flera fält var mer än dubbelt så långa som tillåtet. Förslaget slängdes." };
  }

  if (seoTitle.length > POLISH_LIMITS.seoTitleMaxChars) warnings.push("Seo-titeln kortades till 60 tecken.");
  if (seoDescription.length > POLISH_LIMITS.seoDescriptionMaxChars) {
    warnings.push("Seo-beskrivningen kortades till 155 tecken.");
  }

  const services = input.services.map((service, i) => {
    const desc = proposed.services[i].desc.trim();
    if (desc.length > POLISH_LIMITS.serviceDescMaxChars) {
      warnings.push(`Texten för "${service.name}" kortades till 140 tecken.`);
    }
    return { name: service.name, desc: clampText(desc, POLISH_LIMITS.serviceDescMaxChars) };
  });

  if (input.city && !seoTitle.toLowerCase().includes(input.city.toLowerCase())) {
    warnings.push(`Seo-titeln nämner inte ${input.city} — kontrollera den innan du tillämpar.`);
  }

  return {
    ok: true,
    warnings,
    value: {
      description,
      seoTitle: clampText(seoTitle, POLISH_LIMITS.seoTitleMaxChars),
      seoDescription: clampText(seoDescription, POLISH_LIMITS.seoDescriptionMaxChars),
      services,
    },
  };
}

// ---------- diff ----------

export const POLISH_FIELDS = ["description", "seoTitle", "seoDescription", "services"] as const;
export type PolishFieldKey = (typeof POLISH_FIELDS)[number];

export const POLISH_FIELD_LABELS: Record<PolishFieldKey, string> = {
  description: "Beskrivning",
  seoTitle: "Seo-titel",
  seoDescription: "Seo-beskrivning",
  services: "Tjänstetexter",
};

export type PolishCurrent = {
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  services: { name: string; desc?: string }[];
};

export type FieldDiff = {
  key: PolishFieldKey;
  label: string;
  current: string;
  proposed: string;
  changed: boolean;
};

/** Tjänstelistan visas som en rad per tjänst — en textdiff räcker för granskningen. */
export function servicesToText(services: { name: string; desc?: string }[]): string {
  return services.map((s) => `${s.name} — ${(s.desc ?? "").trim() || "(ingen text)"}`).join("\n");
}

/** Ren funktion för panelen: vad skiljer det sparade från förslaget? */
export function diffFields(current: PolishCurrent, proposed: PolishResult): FieldDiff[] {
  const pairs: Record<PolishFieldKey, [string, string]> = {
    description: [(current.description ?? "").trim(), proposed.description],
    seoTitle: [(current.seoTitle ?? "").trim(), proposed.seoTitle],
    seoDescription: [(current.seoDescription ?? "").trim(), proposed.seoDescription],
    services: [servicesToText(current.services), servicesToText(proposed.services)],
  };

  return POLISH_FIELDS.map((key) => {
    const [before, after] = pairs[key];
    return { key, label: POLISH_FIELD_LABELS[key], current: before, proposed: after, changed: before !== after };
  });
}

// ---------- API-anropet ----------

/**
 * `output_config.effort` avvisas med 400 av Haiku 4.5 och Sonnet 4.5. Modellen
 * är konfigurerbar (AI_POLISH_MODEL), och Haiku är den dokumenterade
 * billigvarianten, så flaggan måste utelämnas för dem.
 */
export function supportsEffort(model: string): boolean {
  return !/^claude-haiku/.test(model) && !/^claude-sonnet-4-5/.test(model);
}

export type PolishOutcome =
  | { ok: true; result: PolishResult; warnings: string[]; usage: PolishUsage }
  | { ok: false; error: string };

/**
 * Själva anropet. `messages.parse` ger `parsed_output` typat mot zod-schemat;
 * ingen prefill, inget streaming — svaret är fyra korta fält.
 */
function callModel(client: Anthropic, model: string, input: PolishInput) {
  return client.messages.parse({
    model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    output_config: {
      format: zodOutputFormat(polishResponseSchema),
      // Ren copywriting: låg effort räcker och håller kostnaden vid ~₲300/sajt.
      ...(supportsEffort(model) ? { effort: "low" as const } : {}),
    },
    messages: [{ role: "user", content: renderUserPrompt(input) }],
  });
}

/**
 * Ett anrop, ett förslag. Allt som kan gå fel blir ett svenskt adminfel —
 * panelen ska aldrig visa en stacktrace och sidan ska aldrig krascha.
 */
export async function polishBusiness(business: PolishBusiness): Promise<PolishOutcome> {
  const apiKey = env.anthropicApiKey;
  if (!apiKey) return { ok: false, error: `${MISSING_KEY_MESSAGE}.` };

  const input = buildPolishInput(business);
  const blockers = polishInputBlockers(input);
  if (blockers.length > 0) return { ok: false, error: blockers.join(" ") };

  const model = env.aiPolishModel;
  const client = new Anthropic({ apiKey });

  let message: Awaited<ReturnType<typeof callModel>>;
  try {
    message = await callModel(client, model, input);
  } catch (error) {
    return { ok: false, error: describeApiError(error) };
  }

  // stop_reason läses FÖRE innehållet: ett avböjt eller avklippt svar har ett
  // content-fält som ser normalt ut men inte är ett komplett förslag.
  if (message.stop_reason === "refusal") {
    const why = message.stop_details?.explanation ?? message.stop_details?.category ?? "utan angiven orsak";
    return { ok: false, error: `Modellen avböjde att svara (${why}). Se över kundens råtext.` };
  }
  if (message.stop_reason === "max_tokens") {
    return { ok: false, error: "Svaret klipptes av (max_tokens). Korta ner kundens råtext och kör igen." };
  }

  const validation = validateProposal(input, message.parsed_output);
  if (!validation.ok) return validation;

  return {
    ok: true,
    result: validation.value,
    warnings: validation.warnings,
    usage: {
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    },
  };
}

/** SDK:ns typade felklasser — aldrig strängmatchning på felmeddelanden. */
function describeApiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY avvisades av API:t.";
  if (error instanceof Anthropic.RateLimitError) return "API:t rate-limitade anropet. Försök om en stund.";
  if (error instanceof Anthropic.BadRequestError) return `API:t avvisade anropet: ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) return "Kunde inte nå Claude API (nätverk).";
  if (error instanceof Anthropic.APIError) return `Claude API svarade ${error.status}: ${error.message}`;
  return "Okänt fel mot Claude API.";
}
