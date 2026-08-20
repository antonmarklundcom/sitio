import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Systemytor och förhandsvisningar hör inte hemma i indexet.
      disallow: ["/admin", "/mi-sitio", "/alta", "/api/", "/preview/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
