import { getPromoSettings } from "@/lib/settings";
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
  LandingPromo,
  LandingRibbon,
  LandingSteps,
} from "@/components/landing/sections";
import "@/styles/landing.css";

// Cache the public page for 60 seconds; unavailable settings render no banner.
export const revalidate = 60;

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
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

export default async function LandingPage() {
  const promo = await getPromoSettings().catch(() => null);
  const contact = salesContact(env.salesWhatsapp);
  if (contact.display === null) {
    // Byggvarning, aldrig ett krasch: CTA:n pekar på #contacto i stället.
    console.warn(
      "[landing] NEXT_PUBLIC_SALES_WHATSAPP saknas eller går inte att tolka som PY-nummer — CTA:n pekar på #contacto.",
    );
  }

  const organization = organizationJsonLd(absoluteUrl("/"), contact.e164);
  const faq = faqJsonLd();

  // All text här är vår egen, men `</script>` i en framtida FAQ-formulering
  // skulle stänga taggen. Escapa `<` en gång, på vägen ut.
  const ld = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <div className={`lp ${displayFont.variable} ${textFont.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ld(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ld(faq) }}
      />

      <LandingHeader contact={contact} />
      <main>
        {promo?.trialEnabled && <LandingPromo text={promo.bannerText} />}
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
