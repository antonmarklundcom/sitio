/**
 * Klientsäkra delar av mediahanteringen. Ligger separat eftersom src/lib/media.ts
 * importerar sharp och "server-only" — en enda konstant därifrån räcker för att
 * dra in hela sharp-binären i klientbundlen.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const ACCEPT_ATTR = ALLOWED_MIME.join(",");

/** Fotogränser per plan. Gallery-modulen höjer taket. */
export const MAX_PHOTOS_BASE = 8;
export const MAX_PHOTOS_GALLERY = 20;

export const PHOTO_WIDTHS = [400, 800, 1600] as const;
export const LOGO_WIDTH = 256;

export type MediaVariants = { w400?: string; w800?: string; w1600?: string };

/** Publik URL för en variant. Relativ — ingen domän hårdkodas. */
export function mediaUrl(businessId: number, fileName: string | undefined): string | null {
  return fileName ? `/media/${businessId}/${fileName}` : null;
}

/** srcset för <img>. next/image används medvetet inte för kundbilder. */
export function mediaSrcSet(businessId: number, variants: MediaVariants): string {
  const parts: string[] = [];
  for (const w of PHOTO_WIDTHS) {
    const file = variants[`w${w}` as keyof MediaVariants];
    if (file) parts.push(`${mediaUrl(businessId, file)} ${w}w`);
  }
  return parts.join(", ");
}

/** Största tillgängliga varianten — används som src-fallback. */
export function largestVariant(variants: MediaVariants): string | undefined {
  return variants.w1600 ?? variants.w800 ?? variants.w400;
}

/** Minsta tillgängliga varianten — miniatyrer i admin. */
export function smallestVariant(variants: MediaVariants): string | undefined {
  return variants.w400 ?? variants.w800 ?? variants.w1600;
}
