import { displayFont, textFont } from "@/themes/fonts";
import { JS_FLAG } from "@/components/site/site-scripts";
import "@/themes/theme.css";
import "@/themes/servicios/servicios.css";

/**
 * Kundsajterna delar inget synligt chrome med varandra eller med adminet —
 * de ska upplevas som fristående sajter. Layouten sätter bara typsnitten.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${displayFont.variable} ${textFont.variable}`}
      style={
        {
          "--font-display": "var(--font-display-family)",
          "--font-text": "var(--font-text-family)",
        } as React.CSSProperties
      }
    >
      {/* Före paint: reveal-animationen göms bara när JS faktiskt kör. */}
      <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      {children}
    </div>
  );
}
