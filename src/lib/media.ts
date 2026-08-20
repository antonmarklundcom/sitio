import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "./env";
import { LOGO_WIDTH, PHOTO_WIDTHS, type MediaVariants } from "./media-shared";

export * from "./media-shared";


export type ProcessedMedia = {
  fileKey: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  variants: MediaVariants;
};

/**
 * Roten för uppladdningar. MÅSTE ligga utanför deploy-trädet — Hostingers
 * git-deploy skriver om appkatalogen, och filer i public/ försvinner då.
 */
function uploadsRoot(): string {
  return path.resolve(env.uploadsDir);
}

/** Katalogen för ett business. Namnet är ett heltal, aldrig användarindata. */
function businessDir(businessId: number): string {
  if (!Number.isInteger(businessId) || businessId <= 0) throw new Error("Ogiltigt businessId.");
  return path.join(uploadsRoot(), String(businessId));
}

/**
 * Löser ut en fil på disk och vägrar allt som hamnar utanför uploads-roten.
 * Enda försvaret mot path traversal i serverings-routen — filnamnet kommer
 * från URL:en och är därmed helt opålitligt.
 */
export function resolveMediaPath(businessId: string, fileName: string): string | null {
  if (!/^\d+$/.test(businessId)) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) return null;
  if (fileName.includes("..")) return null;

  const root = uploadsRoot();
  const resolved = path.resolve(root, businessId, fileName);
  if (resolved !== path.join(root, businessId, fileName)) return null;
  if (!resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

export async function readMediaFile(absPath: string): Promise<{ body: Buffer; size: number } | null> {
  try {
    const info = await stat(absPath);
    if (!info.isFile()) return null;
    return { body: await readFile(absPath), size: info.size };
  } catch {
    return null;
  }
}

export function contentTypeFor(fileName: string): string {
  if (fileName.endsWith(".webp")) return "image/webp";
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/**
 * Processar en uppladdad bild: EXIF strippas, orientering bakas in, varianter
 * skrivs som webp. Originalet sparas aldrig — vi behåller bara varianterna.
 *
 * Hash-i-filnamnet gör att en utbytt bild får en ny URL, vilket är hela
 * poängen med immutable-cachen i serverings-routen.
 */
export async function processImage(params: {
  businessId: number;
  buffer: Buffer;
  kind: "logo" | "photo" | "menu_item" | "product" | "receipt";
}): Promise<ProcessedMedia> {
  const { businessId, buffer, kind } = params;

  const dir = businessDir(businessId);
  await mkdir(dir, { recursive: true });

  const hash = createHash("sha256")
    .update(buffer)
    .update(randomBytes(8)) // två kunder med samma stockbild ska inte dela filnamn
    .digest("hex")
    .slice(0, 16);

  // rotate() utan argument använder EXIF-orienteringen och slänger sedan taggen.
  const base = sharp(buffer, { failOn: "error" }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Kunde inte läsa bildens dimensioner.");

  const variants: ProcessedMedia["variants"] = {};
  let totalBytes = 0;
  let mime = "image/webp";

  if (kind === "logo") {
    // Loggan behåller transparens ⇒ png, inte webp.
    const out = await base
      .clone()
      .resize({ width: LOGO_WIDTH, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    const fileName = `${hash}-logo.png`;
    await writeFile(path.join(dir, fileName), out);
    variants.w400 = fileName;
    totalBytes = out.length;
    mime = "image/png";
  } else {
    for (const width of PHOTO_WIDTHS) {
      if (meta.width < width && width !== PHOTO_WIDTHS[0]) continue; // förstora aldrig
      const out = await base
        .clone()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      const fileName = `${hash}-w${width}.webp`;
      await writeFile(path.join(dir, fileName), out);
      variants[`w${width}` as keyof ProcessedMedia["variants"]] = fileName;
      totalBytes += out.length;
    }
  }

  return {
    fileKey: `${businessId}/${hash}`,
    mime,
    width: meta.width,
    height: meta.height,
    bytes: totalBytes,
    variants,
  };
}

/** Raderar alla varianter för ett media. Saknade filer är inte ett fel. */
export async function deleteMediaFiles(businessId: number, variants: Record<string, string | undefined>): Promise<void> {
  const dir = businessDir(businessId);
  for (const fileName of Object.values(variants)) {
    if (!fileName) continue;
    await rm(path.join(dir, fileName), { force: true });
  }
}
