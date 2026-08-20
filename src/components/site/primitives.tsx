import { mediaSrcSet, type MediaVariants } from "@/lib/media-shared";

export function WhatsAppGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm5.8 14.16c-.25.69-1.44 1.32-1.99 1.4-.51.08-1.15.11-1.86-.12-.43-.13-.98-.32-1.69-.62-2.97-1.28-4.91-4.27-5.06-4.47-.15-.2-1.21-1.6-1.21-3.06 0-1.45.76-2.17 1.03-2.46.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.25.6.84 2.06.91 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.45.3.15.47.13.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.72.81 2.01.96.3.15.5.22.57.35.07.12.07.72-.18 1.41Z" />
    </svg>
  );
}

export function SiteImage({
  businessId,
  variants,
  alt,
  className,
  sizes,
  priority,
  width,
  height,
}: {
  businessId: number;
  variants: MediaVariants;
  alt: string;
  className?: string;
  sizes: string;
  priority?: boolean;
  width?: number | null;
  height?: number | null;
}) {
  const largest = variants.w1600 ?? variants.w800 ?? variants.w400;
  if (!largest) return null;

  return (
    // next/image används medvetet inte för kundbilder — vi servar färdiga
    // varianter, och Hostinger-managed har ingen bra optimizer-cache.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/media/${businessId}/${largest}`}
      srcSet={mediaSrcSet(businessId, variants)}
      sizes={sizes}
      alt={alt}
      className={className}
      width={width ?? undefined}
      height={height ?? undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? "sync" : "async"}
    />
  );
}
