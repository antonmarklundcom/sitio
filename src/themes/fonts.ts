import { Bricolage_Grotesque, Inter_Tight } from "next/font/google";

/**
 * Exakt ett display-snitt och ett brödtextsnitt, enligt web-design-system.
 * Subsettade till latin (spanska), font-display: swap.
 *
 * Valen ligger i docs/PALETTE-REGISTRY.md. Bricolage Grotesque är avsiktligt
 * inte Inter/Oswald — de är portföljens vanligaste, och tre sajter med samma
 * display-snitt är exakt den sameness registret finns för att stoppa.
 */
export const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display-family",
  display: "swap",
});

export const textFont = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-text-family",
  display: "swap",
});
