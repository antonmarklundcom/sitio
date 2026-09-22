import { ImageResponse } from "next/og";

/**
 * Delningskortet för landningssidan, ritat i kod (ingen bild i repot, ingen
 * AI-bild). Samma palett som `.lp` i landing.css: nästan svart bas, en
 * WhatsApp-grön accent. Standardtypsnittet i next/og (en vikt) räcker —
 * inga typsnittsfiler att ladda. "Gs." i stället för ₲: tecknet saknas i
 * standardtypsnittet.
 *
 * Kundsajterna (`/[slug]`) ärver inte kortet: siteMetadata sätter alltid egna
 * `openGraph.images` (heron eller en tom lista).
 */
export const alt = "sitio.com.py — páginas web para negocios de Paraguay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0b0d12";
const SURFACE = "#141821";
const INK = "#e9ebef";
const MUTED = "#98a0b0";
const ACCENT = "#2fd07a";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: BG,
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: ACCENT }} />
          <div style={{ fontSize: 34, letterSpacing: -0.5 }}>sitio.com.py</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>
            Páginas web para negocios de Paraguay
          </div>
          <div style={{ fontSize: 34, color: MUTED, lineHeight: 1.3 }}>
            WhatsApp, horario y mapa. Publicada en 48 h.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              padding: "14px 28px",
              borderRadius: 999,
              background: ACCENT,
              color: "#06170e",
              fontSize: 30,
              whiteSpace: "nowrap",
            }}
          >
            Desde Gs. 300.000 por año
          </div>
          <div
            style={{
              display: "flex",
              padding: "14px 28px",
              borderRadius: 999,
              background: SURFACE,
              color: MUTED,
              fontSize: 30,
              whiteSpace: "nowrap",
            }}
          >
            Editás vos textos y fotos
          </div>
        </div>
      </div>
    ),
    size,
  );
}
