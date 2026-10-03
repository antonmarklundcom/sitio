import { z } from "zod";
import { normalizePyPhone, parseGs } from "./format";
import { leadReplyMessage } from "./growth";

/**
 * Rena hjälpare för ägarens CRM ("Mis clientes", crm-1): pipelinen, flikar,
 * ref-koden, belopp, CSV och uppföljningsdagar. Ingen DB och inga serverimporter
 * — testas i tests/unit/crm.test.ts. Spanska (voseo) i texterna ägaren ser.
 */

// ---------- pipeline ----------

export const LEAD_STATUSES = ["nuevo", "contactado", "cliente", "perdido", "cerrado"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo: "Nueva",
  contactado: "Respondida",
  cliente: "Cliente",
  perdido: "Perdida",
  cerrado: "Cerrada", // growth-1:s gamla slutläge
};

export function statusLabel(status: string): string {
  return status in STATUS_LABELS ? STATUS_LABELS[status as LeadStatus] : status;
}

/**
 * Vad ägaren kan välja i listan. "cerrado" erbjuds bara när leaden redan har
 * den — det är ett gammalt läge som inte ska väljas på nya leads.
 */
export function selectableStatuses(current: string): LeadStatus[] {
  const base: LeadStatus[] = ["nuevo", "contactado", "cliente", "perdido"];
  return current === "cerrado" ? [...base, "cerrado"] : base;
}

/** Är bytet tillåtet? Samma status är alltid ok; "cerrado" kan inte väljas från något annat. */
export function canTransition(from: string, to: string): boolean {
  if (!(LEAD_STATUSES as readonly string[]).includes(to)) return false;
  if (from === to) return true;
  return selectableStatuses(from).includes(to as LeadStatus);
}

/** "Responder por WhatsApp" flyttar bara en ny lead framåt — aldrig bakåt eller ur cliente/perdido. */
export function statusAfterReply(current: string): LeadStatus | null {
  return current === "nuevo" ? "contactado" : null;
}

/** Leads som är avgjorda: inga påminnelser, inget "para hoy". */
export function isResolved(status: string): boolean {
  return status === "cliente" || status === "perdido" || status === "cerrado";
}

// ---------- flikar, sök, sidor ----------

export const CRM_TABS = ["nuevas", "curso", "clientes", "perdidas", "todas"] as const;
export type CrmTab = (typeof CRM_TABS)[number];

export const TAB_LABELS: Record<CrmTab, string> = {
  nuevas: "Nuevas",
  curso: "En curso",
  clientes: "Clientes",
  perdidas: "Perdidas",
  todas: "Todas",
};

/** Statusar per flik; "todas" har ingen begränsning. "Cerrada" syns bara under Todas. */
export const TAB_STATUSES: Record<CrmTab, readonly LeadStatus[] | null> = {
  nuevas: ["nuevo"],
  curso: ["contactado"],
  clientes: ["cliente"],
  perdidas: ["perdido"],
  todas: null,
};

export function parseTab(raw: unknown): CrmTab {
  return (CRM_TABS as readonly string[]).includes(String(raw)) ? (raw as CrmTab) : "nuevas";
}

export const PAGE_SIZE = 50;

export function parsePage(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

export type LeadSearch = { text: string | null; phone: string | null; phoneDigits: string | null };

/**
 * Söksträngen → namnsökning och/eller telefonsökning. Ett helt PY-nummer
 * ("0981 123 456") blir E.164 för exakt träff; en delsiffra ("123 456") blir en
 * LIKE på siffrorna. Allt annat är en namnsökning.
 */
export function parseSearch(raw: unknown): LeadSearch {
  const q = String(raw ?? "").trim().slice(0, 60);
  if (!q) return { text: null, phone: null, phoneDigits: null };
  if (/^[\d\s+().-]+$/.test(q)) {
    const phone = normalizePyPhone(q);
    const digits = q.replace(/\D/g, "").replace(/^(595|0)/, "");
    return { text: null, phone, phoneDigits: digits.length >= 3 ? digits : null };
  }
  return { text: q, phone: null, phoneDigits: null };
}

/** Skyddar mot att ägarens `%` och `_` blir jokertecken i en LIKE. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------- uppföljning ----------

/** Uppföljningsdag som YYYY-MM-DD ur en Date (DB) eller sträng; null om ingen. */
export function dayOf(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const s = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** "Para hoy": uppföljningsdagen är idag eller passerad och leaden är inte avgjord. */
export function isFollowUpDue(followUpDay: Date | string | null | undefined, status: string, today: string): boolean {
  const day = dayOf(followUpDay);
  return day !== null && day <= today && !isResolved(status);
}

/** Första dagen i månaden för en dag (Asunción-dagen från todayAsuncion). */
export function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

// ---------- ref-koden ----------

export const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const REF_LENGTH = 4;
export const REF_WINDOW_DAYS = 60;

const REF_RE = new RegExp(`^[${REF_ALPHABET}]{${REF_LENGTH}}$`);

/**
 * "ref k7q2", "REF: K7Q2", "k7q2" → "K7Q2". Null när det inte är en kod.
 * En ren kod som råkar börja på REF ("REFX") läses som kod, inte som prefix.
 */
export function normalizeRefCode(raw: unknown): string | null {
  const compact = String(raw ?? "").toUpperCase().replace(/\s/g, "");
  if (REF_RE.test(compact)) return compact;
  const stripped = compact.replace(/^REF[:#_-]*/, "").replace(/[-_]/g, "");
  return REF_RE.test(stripped) ? stripped : null;
}

// ---------- WhatsApp-svar ----------

export type CrmReplyLead = {
  name: string;
  kind: string;
  serviceName?: string | null;
  requestedDay?: string | null;
  requestedTime?: string | null;
};

/** Förifylld text till kunden. consulta/turno använder growth-1:s texter; chatt och manuell får en neutral. */
export function crmReplyMessage(lead: CrmReplyLead, businessName: string): string {
  if (lead.kind === "consulta" || lead.kind === "turno") {
    return leadReplyMessage({ ...lead, kind: lead.kind }, businessName);
  }
  const first = lead.name.split(/\s+/)[0] ?? lead.name;
  if (lead.kind === "whatsapp") return `Hola ${first}! Te escribo de ${businessName}, para seguir con tu consulta.`;
  return `Hola ${first}! Te escribo de ${businessName}.`;
}

export const KIND_LABELS: Record<string, string> = {
  consulta: "Consulta",
  turno: "Turno",
  whatsapp: "Chat de WhatsApp",
  manual: "Agregado a mano",
};

// ---------- CSV ----------

/**
 * En CSV-cell. Celler som börjar på = + - @ (eller tab/CR) tolkas som formel i
 * Excel/Sheets — de får ett ' först. Citat och radbrytningar escapas enligt RFC 4180.
 */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

export const CSV_BOM = "﻿";

export type CsvLead = {
  name: string;
  phone: string;
  kind: string;
  status: string;
  source: string | null;
  message: string | null;
  notes: string | null;
  followUpDay: Date | string | null;
  valueGs: number | null;
  createdAt: Date | string;
};

export const CSV_HEADERS = ["Nombre", "Teléfono", "Tipo", "Estado", "Origen", "Mensaje", "Notas", "Seguimiento", "Valor (Gs)", "Fecha"];

/** Hela filen: BOM så att Excel läser UTF-8, CRLF mellan raderna. */
export function leadsToCsv(rows: CsvLead[]): string {
  const lines = [csvRow(CSV_HEADERS)];
  for (const r of rows) {
    const created = r.createdAt instanceof Date ? r.createdAt.toISOString().slice(0, 10) : String(r.createdAt).slice(0, 10);
    lines.push(
      csvRow([
        r.name,
        r.phone,
        KIND_LABELS[r.kind] ?? r.kind,
        statusLabel(r.status),
        r.source ?? "",
        r.message ?? "",
        r.notes ?? "",
        dayOf(r.followUpDay) ?? "",
        r.valueGs ?? "",
        created,
      ]),
    );
  }
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

// ---------- zod ----------

const dayField = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)), {
    message: "Elegí una fecha válida.",
  })
  .transform((v) => (v === "" ? null : v));

const nameField = z.string().trim().min(1, "Poné el nombre.").max(80, "Máximo 80 caracteres.");

const phoneField = z
  .string()
  .trim()
  .min(1, "Poné el número de WhatsApp.")
  .transform((v, ctx) => {
    const p = normalizePyPhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Ese número no parece de Paraguay. Probá con 0981 123 456." });
      return z.NEVER;
    }
    return p;
  });

const notesField = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const MAX_VALUE_GS = 99_999_999_999;

const valueField = z.preprocess(
  (raw) => parseGs(raw),
  z
    .number({ message: "Poné el monto en guaraníes, por ejemplo 150.000." })
    .int()
    .min(0, "El monto no puede ser negativo.")
    .max(MAX_VALUE_GS, "Ese monto es demasiado grande.")
    .nullable(),
);

const leadIdField = z.coerce.number().int().positive();

/** "Agregar cliente" */
export const addCustomerSchema = z.object({
  name: nameField,
  phone: phoneField,
  note: notesField(2000),
  followUpDay: dayField,
});

/** "Registrar chat por código" */
export const refCustomerSchema = z.object({
  code: z.string().transform((v, ctx) => {
    const code = normalizeRefCode(v);
    if (!code) {
      ctx.addIssue({ code: "custom", message: "El código tiene 4 letras o números, por ejemplo K7Q2." });
      return z.NEVER;
    }
    return code;
  }),
  name: nameField,
  phone: phoneField,
});

/** Redigera en lead. */
export const updateLeadSchema = z.object({
  leadId: leadIdField,
  status: z.enum(LEAD_STATUSES, { message: "Elegí un estado." }),
  notes: notesField(2000),
  followUpDay: dayField,
  valueGs: valueField,
});

export const leadIdSchema = z.object({ leadId: leadIdField });

/** Första felet per fält, för fieldErrors i formulärets state. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}
