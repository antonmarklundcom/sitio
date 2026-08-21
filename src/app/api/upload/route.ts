import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, businessModules, media } from "@/db/schema";
import { currentUser } from "@/lib/session";
import { getIntakeBusinessId } from "@/db/intake-queries";
import { tokenFingerprint } from "@/lib/intake";
import { rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/auth";
import { processImage } from "@/lib/media";
import {
  ALLOWED_MIME,
  MAX_PHOTOS_BASE,
  MAX_PHOTOS_GALLERY,
  MAX_UPLOAD_BYTES,
} from "@/lib/media-shared";

export const runtime = "nodejs";

const KINDS = ["logo", "photo", "menu_item", "product", "receipt"] as const;
type Kind = (typeof KINDS)[number];

function isKind(v: string): v is Kind {
  return (KINDS as readonly string[]).includes(v);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const user = await currentUser();

  /**
   * Två sätt att vara behörig: en inloggad session (admin/owner), eller en
   * giltig intake-token (PR-10) — kunden som fyller i formuläret har inget
   * konto. Token slås upp mot databasen och bestämmer SJÄLV vilket business
   * uppladdningen hamnar på; ett businessId i formuläret ignoreras då.
   */
  const intakeToken = String(form.get("token") ?? "").trim();
  let businessId = Number(form.get("businessId"));

  if (user?.role === "owner") {
    // En owner har exakt ett business. Att läsa det ur sessionen i stället för
    // ur formuläret gör tenant-checken omöjlig att kringgå — det finns inget
    // fält kvar att manipulera.
    if (!user.businessId) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    businessId = user.businessId;
  }

  if (!user) {
    if (!intakeToken) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    if (!rateLimit(`upload-token:${tokenFingerprint(intakeToken)}`, 30, 600_000).ok) {
      return NextResponse.json({ error: "Demasiadas subidas. Esperá unos minutos." }, { status: 429 });
    }
    const tokenBusinessId = await getIntakeBusinessId(intakeToken);
    if (!tokenBusinessId) return NextResponse.json({ error: "Este enlace ya no es válido." }, { status: 403 });
    businessId = tokenBusinessId;
  }

  const kindRaw = String(form.get("kind") ?? "photo");
  const file = form.get("file");

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "Ogiltigt businessId." }, { status: 400 });
  }
  if (!isKind(kindRaw)) return NextResponse.json({ error: "Ogiltig bildtyp." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Ingen fil bifogad." }, { status: 400 });

  // Tenant-check: en owner får bara ladda upp till sitt eget business. Kunden
  // med intake-token har redan fått businessId satt av token ovan.
  if (user && user.role !== "superadmin" && user.businessId !== businessId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  // Kvitton hör till betalningsflödet i admin och ska aldrig gå att ladda upp
  // med en intake-token eller av en owner.
  if (user?.role !== "superadmin" && kindRaw !== "photo" && kindRaw !== "logo") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const [business] = await db
    .select({ id: businesses.id, slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!business) return NextResponse.json({ error: "Sajten finns inte." }, { status: 404 });

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Bilden är större än 10 MB." }, { status: 413 });
  }
  if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Formatet stöds inte. Använd JPEG, PNG, WEBP eller HEIC." }, { status: 415 });
  }

  // Fototak: höjs av gallery-modulen.
  if (kindRaw === "photo") {
    const [gallery] = await db
      .select({ isEnabled: businessModules.isEnabled })
      .from(businessModules)
      .where(and(eq(businessModules.businessId, businessId), eq(businessModules.moduleKey, "gallery")))
      .limit(1);
    const limit = gallery?.isEnabled ? MAX_PHOTOS_GALLERY : MAX_PHOTOS_BASE;

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(media)
      .where(and(eq(media.businessId, businessId), eq(media.kind, "photo")));

    if (Number(n) >= limit) {
      return NextResponse.json(
        { error: `Max ${limit} foton. Ta bort en bild först, eller slå på gallery-modulen.` },
        { status: 409 },
      );
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let processed;
  try {
    processed = await processImage({ businessId, buffer, kind: kindRaw });
  } catch {
    return NextResponse.json({ error: "Bilden gick inte att läsa. Är filen skadad?" }, { status: 422 });
  }

  // En logga i taget: den gamla ersätts.
  if (kindRaw === "logo") {
    await db.delete(media).where(and(eq(media.businessId, businessId), eq(media.kind, "logo")));
  }

  const [{ nextSort }] = await db
    .select({ nextSort: sql<number>`coalesce(max(sort_order), -1) + 1` })
    .from(media)
    .where(and(eq(media.businessId, businessId), eq(media.kind, kindRaw)));

  await db.insert(media).values({
    businessId,
    kind: kindRaw,
    fileKey: processed.fileKey,
    mime: processed.mime,
    width: processed.width,
    height: processed.height,
    bytes: processed.bytes,
    variantsJson: processed.variants,
    altText: String(form.get("altText") ?? "").slice(0, 160) || null,
    sortOrder: Number(nextSort),
  });

  const [created] = await db
    .select()
    .from(media)
    .where(and(eq(media.businessId, businessId), eq(media.fileKey, processed.fileKey)))
    .limit(1);

  if (kindRaw === "logo") {
    await db.update(businesses).set({ logoMediaId: created.id }).where(eq(businesses.id, businessId));
  }

  await logActivity({
    // Utan session är det kunden själv som laddat upp via intake-länken.
    actorUserId: user?.userId ?? null,
    businessId,
    action: "media_uploaded",
    meta: {
      kind: kindRaw,
      fileKey: processed.fileKey,
      bytes: processed.bytes,
      viaIntake: !user,
      byOwner: user?.role === "owner",
    },
  });

  // Utan detta syns en ny bild på den publika sajten först när ISR-fönstret
  // löper ut (en timme). En owner som just bytt bild ska se den direkt.
  revalidateTag(`biz:${business.slug}`);
  revalidatePath(`/admin/sitios/${businessId}`);
  if (user?.role === "owner") revalidatePath("/mi-sitio");

  return NextResponse.json({ id: created.id, fileKey: created.fileKey, variants: created.variantsJson });
}
