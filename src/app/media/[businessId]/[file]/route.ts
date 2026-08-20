import { contentTypeFor, readMediaFile, resolveMediaPath } from "@/lib/media";

export const runtime = "nodejs";
// Dynamisk route: filerna ligger på disk utanför bygget och kan inte
// prerenderas. Cachningen sköts av Cache-Control-headern nedan.
export const dynamic = "force-dynamic";

/**
 * Servering av kundbilder. Filnamnet innehåller en hash av innehållet, så en
 * utbytt bild får ny URL — därför är immutable-cachen säker.
 *
 * Filnamnet kommer från URL:en och är helt opålitligt; resolveMediaPath()
 * är enda försvaret mot path traversal.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ businessId: string; file: string }> },
) {
  const { businessId, file } = await params;

  const absPath = resolveMediaPath(businessId, file);
  if (!absPath) return new Response("Not found", { status: 404 });

  const found = await readMediaFile(absPath);
  if (!found) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(found.body), {
    headers: {
      "Content-Type": contentTypeFor(file),
      "Content-Length": String(found.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
