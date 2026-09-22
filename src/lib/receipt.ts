import "server-only";
import { db } from "@/db";
import { media } from "@/db/schema";
import { processImage } from "./media";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from "./media-shared";

/**
 * Kvittobilden till en betalning. Samma pipeline som alla bilder (EXIF
 * strippas, webp-varianter), kind `receipt` — som aldrig visas på sajten och
 * aldrig går att ladda upp via /api/upload utan superadmin. Delad av adminets
 * registrering och kundens egen rapport (R3-21).
 *
 * Ingen fil (eller en tom) är inte ett fel: `{ mediaId: null }`.
 */
export async function storeReceipt(
  businessId: number,
  file: FormDataEntryValue | null,
  altText: string,
): Promise<{ mediaId: number | null } | { error: "size" | "mime" | "unreadable" }> {
  if (!(file instanceof File) || file.size === 0) return { mediaId: null };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "size" };
  if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) return { error: "mime" };

  try {
    const processed = await processImage({
      businessId,
      buffer: Buffer.from(await file.arrayBuffer()),
      kind: "receipt",
    });
    const [inserted] = await db.insert(media).values({
      businessId,
      kind: "receipt",
      fileKey: processed.fileKey,
      mime: processed.mime,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
      variantsJson: processed.variants,
      altText: altText.slice(0, 160),
    });
    return { mediaId: Number(inserted.insertId) };
  } catch {
    return { error: "unreadable" };
  }
}
