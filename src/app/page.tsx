import type { Metadata } from "next";
import { absoluteUrl, env } from "@/lib/env";
import { displayFont, textFont } from "@/themes/fonts";
import { faqJsonLd, organizationJsonLd } from "@/components/landing/content";
import { salesContact } from "@/components/landing/sales-contact";
import {
  LandingClosing,
  LandingDock,
  LandingFaq,
  LandingFeatures,
  LandingFooter,
  LandingHeader,
  LandingHero,
  LandingPricing,
  LandingRibbon,
  LandingSteps,
} from "@/components/landing/sections";
import "@/styles/landing.css";

/**
 * Säljsidan för sitio.com.py. Statisk och databaslös (plan.md §1.4): inga
 * dynamiska API:er, ingen `db`-import någonstans i trädet — `next build` ska
 * lista `/` som `○`. Roten listar aldrig kunder (docs/PLAN.md D5).
 */
export const dynamic = "force-static";

const TITLE = "Páginas web para negocios de Paraguay | sitio.com.py";
const DESCRIPTION =
  "Una página de una sola pantalla con WhatsApp, horario y mapa para tu negocio. Publicada en 48 h, desde ₲ 300.000 por año.";

export function generateMetadata(): Metadata {
  const url = absoluteUrl("/");
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "es_PY",
      url,
      siteName: "sitio.com.py",
      title: TITLE,
      description: DESCRIPTION,
    },
    twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
  };
}

export default function LandingPage() {
  const contact = salesContact(env.salesWhatsapp);
  if (contact.display === null) {
    // Byggvarning, aldrig ett krasch: CTA:n pekar på #contacto i stället.
    console.warn(
      "[landing] NEXT_PUBLIC_SALES_WHATSAPP saknas eller går inte att tolka som PY-nummer — CTA:n pekar på #contacto.",
    );
  }

  const organization = organizationJsonLd(absoluteUrl("/"), contact.e164);
  const faq = faqJsonLd();

  return (
    <div className={`lp ${displayFont.variable} ${textFont.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />

      <LandingHeader contact={contact} />
      <main>
        <LandingHero contact={contact} />
        <LandingRibbon />
        <LandingFeatures />
        <LandingSteps />
        <LandingPricing contact={contact} />
        <LandingFaq />
        <LandingClosing contact={contact} />
      </main>
      <LandingFooter contact={contact} />
      <LandingDock contact={contact} />
    </div>
  );
}
