import { Archivo, Instrument_Sans } from "next/font/google";

/**
 * Exakt ett display-snitt och ett brödtextsnitt, enligt web-design-system.
 * Subsettade till latin (spanska), font-display: swap.
 *
 * Valen ligger i docs/PALETTE-REGISTRY.md.
 *
 * Archivo som display: temats rubriker sätts stort och tight på en
 * 360 px-skärm, och Archivos smala apertur och höga x-höjd håller ihop där
 * en bredare grotesk spricker. Den läser som skyltning — vilket är precis
 * vad en företagsnamnrubrik ska göra.
 *
 * Instrument Sans som brödtext, inte Inter Tight: Inter Tight ÄR Inter med
 * smalare spårning, och Inter är portföljens vanligaste snitt. Tre sajter med
 * samma brödtextsnitt är exakt den sameness registret finns för att stoppa.
 */
export const displayFont = Archivo({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display-family",
  display: "swap",
});

export const textFont = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-text-family",
  display: "swap",
});
