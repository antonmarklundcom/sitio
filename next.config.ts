import type { NextConfig } from "next";

/**
 * Content-Security-Policy (R3-24). Allt utom script-src är låst till egen
 * origin, och det är riktigt skydd: ett injicerat skript kan inte skicka
 * data till en annan värd (connect-src, img-src), ingen <base>, <object> eller
 * främmande formulärmål, ingen inbäddning (frame-ancestors).
 *
 * script-src har 'unsafe-inline', och det är INTE ett XSS-skydd. Varje App
 * Router-sida bär ett tjugotal inline-skript med sidans RSC-data
 * (`self.__next_f.push(…)`), olika per sida och per revalidering. Utan
 * 'unsafe-inline' krävs en nonce per svar, och en nonce kräver dynamisk
 * rendering — kundsajterna är ISR (en DB-fråga per timme, inte per besök),
 * och det är hela skalbarhetsstoryn. Hashar går inte heller: innehållet är
 * inte känt när headern sätts. Våra egna tre skript (JS_FLAG, MOTION,
 * ANALYTICS) är konstanter, men en hash i listan får webbläsaren att ignorera
 * 'unsafe-inline' och bryter Nexts skript — de står därför kvar inline.
 * XSS-skyddet är React-escapingen och att ingen användartext når
 * dangerouslySetInnerHTML (JSON-LD escapar `<`).
 *
 * Bara i produktion: `next dev` behöver eval och en websocket för HMR.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  // React-stilattribut (paletten som CSS-variabler) och Nexts typsnitts-CSS.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // Beaconen (/api/ev), uppladdningar och serveråtgärder — alla egen origin.
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Säkerhetsheaders på alla svar (plan.md §5.1, REPORT §2 F9). */
const securityHeaders = [
  // Kundsajterna ska aldrig bäddas in — en iframe av en kundsajt är antingen
  // clickjacking eller någon som stjäl innehållet.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY }]
    : []),
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Kvittot i "Informar pago" och adminets betalningsformulär skickas via
      // serveråtgärder, och Nexts standardtak är 1 MB — en vanlig mobilbild av
      // en överföring (2–5 MB) kraschade åtgärden innan receipt.ts hann säga
      // "más de 10 MB" (R3-32). Samma tak som storeReceipt plus marginal för
      // övriga fält.
      bodySizeLimit: "11mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
