import "server-only";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, onboardingTokens, users } from "@/db/schema";
import { logActivity } from "@/lib/auth";
import { CATEGORIES } from "@/lib/business";
import { normalizePyPhone } from "@/lib/format";
import { PY_TIMEZONE } from "@/lib/hours";
import { presentationFor } from "@/lib/presentation";
import { slugify, uniqueSlugCandidate } from "@/lib/slug";
import { TOKEN_TTL_DAYS, newIntakeToken, tokenFingerprint } from "@/lib/intake";

export const registroSchema = z.object({
  name: z.string().trim().min(2, "Escribí al menos 2 caracteres.").max(120, "Usá hasta 120 caracteres."),
  category: z.enum(CATEGORIES, { error: "Elegí un rubro." }),
  phone: z.string().trim().transform((value, ctx) => {
    const phone = normalizePyPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Escribí un número paraguayo. Ej: 0981 123 456" });
      return z.NEVER;
    }
    return phone;
  }),
  city: z.string().trim().max(80, "Usá hasta 80 caracteres.").optional().transform(value => value || "Asunción"),
  website: z.string().max(0, "No pudimos procesar la solicitud.").default(""),
});

function registrationDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return part("year") + "-" + part("month") + "-" + part("day") + " " + part("hour") + ":" + part("minute");
}

export class RegistrationUnavailableError extends Error {
  constructor() {
    super("El registro no está disponible por ahora. Escribinos por WhatsApp.");
  }
}

export async function createDraftBusinessWithToken({ name, phone, category, city, source, actorUserId }: {
  name: string; phone: string | null; category: string; city: string;
  source: "admin" | "registro"; actorUserId: number | null;
}) {
  let createdByUserId = actorUserId;
  if (createdByUserId === null) {
    const [creator] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.role, "superadmin"), eq(users.status, "active")))
      .orderBy(asc(users.id)).limit(1);
    if (!creator) throw new RegistrationUnavailableError();
    createdByUserId = creator.id;
  }

  const taken = await db.select({ slug: businesses.slug }).from(businesses);
  const slug = uniqueSlugCandidate(
    slugify(name) || "negocio",
    new Set(taken.map((t) => t.slug)),
  );

  const [inserted] = await db.insert(businesses).values({
    slug,
    name: name.slice(0, 120),
    category: category as "otro",
    ...presentationFor(category),
    city,
    // Numret är obekräftat tills kunden matar in koden — men det behövs som
    // platshållare eftersom kolumnen är NOT NULL. Verifieringen är det som
    // spärrar publicering, inte fältets existens.
    whatsappPhone: phone ?? "+595000000000",
    status: "draft",
    ...(source === "registro" ? { adminNotes: "Auto-registro desde /registro el " + registrationDate() } : {}),
  });

  const businessId = Number(inserted.insertId);
  const token = newIntakeToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000);

  await db.insert(onboardingTokens).values({
    token,
    businessId,
    phone,
    prefillJson: { name, city, category },
    createdByUserId,
    expiresAt,
  });

  await logActivity({
    actorUserId: actorUserId,
    businessId,
    action: source === "registro" ? "registro_publico" : "intake_link_created",
    meta: { tokenFingerprint: tokenFingerprint(token), expiresAt: expiresAt.toISOString() },
  });

  return { businessId, token, expiresAt };
}
