"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT_ATTR, MAX_UPLOAD_BYTES, type ItemImage } from "@/lib/media-shared";

/**
 * Bilden på en rätt eller produkt i owner-panelen (R3-16). En bild per rad:
 * "Subir foto" laddar upp, "Cambiar foto" ersätter (rutten raderar den gamla),
 * "Quitar foto" tar bort den. Spanska (voseo) — kundens yta.
 *
 * Inget businessId skickas: för en owner-session tar /api/upload det ur
 * sessionen, och targetId kontrolleras mot tenanten där.
 */
export function ItemImageField({
  kind,
  targetId,
  idField,
  name,
  image,
  removeImage,
}: {
  kind: "menu_item" | "product";
  targetId: number;
  /** Fältnamnet åtgärden läser id:t ur: "itemId" eller "productId". */
  idField: "itemId" | "productId";
  name: string;
  image: ItemImage | null;
  removeImage: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`${file.name} pesa más de 10 MB.`);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("targetId", String(targetId));
      body.set("altText", name);
      body.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No pudimos subir la foto.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="panel-item-image">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt="" loading="lazy" />
      ) : null}
      <label className="panel-item-image-btn">
        {busy ? "Subiendo…" : image ? "Cambiar foto" : "Subir foto"}
        <input
          ref={input}
          type="file"
          accept={ACCEPT_ATTR}
          hidden
          disabled={busy}
          aria-label={`Foto de ${name}`}
          onChange={(e) => upload(e.currentTarget.files)}
        />
      </label>
      {image ? (
        <form action={removeImage}>
          <input type="hidden" name={idField} value={targetId} />
          <button type="submit" className="danger">
            Quitar foto
          </button>
        </form>
      ) : null}
      {error ? <p className="panel-note panel-note--err">{error}</p> : null}
    </div>
  );
}
