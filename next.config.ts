import type { NextConfig } from "next";

/**
 * Säkerhetsheaders på alla svar (plan.md §5.1, REPORT §2 F9).
 *
 * Ingen CSP ännu: temana använder inline-script och en CSP med 'unsafe-inline'
 * hade varit en rad som ser ut som ett skydd utan att vara ett. Den kommer när
 * script-taggarna är hashade eller externa (plan.md §10).
 */
const securityHeaders = [
  // Kundsajterna ska aldrig bäddas in — en iframe av en kundsajt är antingen
  // clickjacking eller någon som stjäl innehållet.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
