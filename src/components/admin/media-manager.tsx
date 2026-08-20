"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT_ATTR, MAX_UPLOAD_BYTES, smallestVariant, type MediaVariants } from "@/lib/media-shared";

export type MediaItem = {
  id: number;
  kind: string;
  variants: MediaVariants;
  altText: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
};

function url(businessId: number, file?: string) {
  return file ? `/media/${businessId}/${file}` : null;
}

export function MediaUploader({
  businessId,
  kind,
  label,
}: {
  businessId: number;
  kind: "logo" | "photo";
  label: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_UPLOAD_BYTES) {
          setError(`${file.name} är större än 10 MB.`);
          continue;
        }
        const body = new FormData();
        body.set("businessId", String(businessId));
        body.set("kind", kind);
        body.set("file", file);

        const res = await fetch("/api/upload", { method: "POST", body });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? `Uppladdningen misslyckades (${res.status}).`);
          break;
        }
      }
      if (inputRef.current) inputRef.current.value = "";
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center rounded-lg border border-admin-line bg-admin-surface-2 px-3 py-2 text-sm hover:border-admin-muted">
        {busy ? "Laddar upp…" : label}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple={kind === "photo"}
          disabled={busy}
          onChange={(e) => upload(e.currentTarget.files)}
          className="sr-only"
        />
      </label>
      {error ? <p className="mt-2 text-sm text-admin-danger">{error}</p> : null}
    </div>
  );
}

export function MediaGrid({
  businessId,
  items,
  heroMediaId,
  onDelete,
  onMove,
  onSetHero,
  onAltText,
}: {
  businessId: number;
  items: MediaItem[];
  heroMediaId: number | null;
  onDelete: (formData: FormData) => Promise<void>;
  onMove: (formData: FormData) => Promise<void>;
  onSetHero: (formData: FormData) => Promise<void>;
  onAltText: (formData: FormData) => Promise<void>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-admin-muted">Inga bilder ännu.</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => {
        const src = url(businessId, smallestVariant(item.variants));
        const isHero = item.id === heroMediaId;
        return (
          <li key={item.id} className="overflow-hidden rounded-xl border border-admin-line bg-admin-surface-2">
            <div className="relative aspect-4/3 bg-admin-bg">
              {src ? (
                // next/image används medvetet inte för kundbilder — vi servar
                // färdiga varianter och Hostinger har ingen bra optimizer-cache.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={item.altText ?? ""} className="h-full w-full object-cover" loading="lazy" />
              ) : null}
              {isHero ? (
                <span className="absolute top-2 left-2 rounded-full bg-admin-accent px-2 py-0.5 text-xs text-white">
                  Hero
                </span>
              ) : null}
            </div>

            <div className="space-y-2 p-3">
              <p className="text-xs text-admin-muted">
                {item.kind} · {item.width}×{item.height} ·{" "}
                {item.bytes ? `${Math.round(item.bytes / 1024)} kB` : "—"}
              </p>

              <form action={onAltText} className="flex gap-1.5">
                <input type="hidden" name="mediaId" value={item.id} />
                <input
                  name="altText"
                  defaultValue={item.altText ?? ""}
                  placeholder="Alt-text (es)"
                  maxLength={160}
                  className="w-full rounded-md border border-admin-line bg-admin-surface px-2 py-1.5 text-xs outline-none focus:border-admin-accent"
                />
                <button type="submit" className="rounded-md border border-admin-line px-2 py-1.5 text-xs hover:border-admin-muted">
                  Spara
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5">
                {item.kind === "photo" && !isHero ? (
                  <form action={onSetHero}>
                    <input type="hidden" name="mediaId" value={item.id} />
                    <button type="submit" className="rounded-md border border-admin-line px-2 py-1.5 text-xs hover:border-admin-accent">
                      Gör till hero
                    </button>
                  </form>
                ) : null}

                {item.kind === "photo" ? (
                  <>
                    <form action={onMove}>
                      <input type="hidden" name="mediaId" value={item.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={i === 0}
                        className="rounded-md border border-admin-line px-2 py-1.5 text-xs hover:border-admin-muted disabled:opacity-30"
                        aria-label="Flytta upp"
                      >
                        ↑
                      </button>
                    </form>
                    <form action={onMove}>
                      <input type="hidden" name="mediaId" value={item.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={i === items.length - 1}
                        className="rounded-md border border-admin-line px-2 py-1.5 text-xs hover:border-admin-muted disabled:opacity-30"
                        aria-label="Flytta ner"
                      >
                        ↓
                      </button>
                    </form>
                  </>
                ) : null}

                <form action={onDelete} className="ml-auto">
                  <input type="hidden" name="mediaId" value={item.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-admin-line px-2 py-1.5 text-xs text-admin-muted hover:border-admin-danger hover:text-admin-danger"
                  >
                    Ta bort
                  </button>
                </form>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
