/**
 * Allt innehåll på landningssidan ligger här, som data. Sektionerna är dumma
 * och renderar listorna; JSON-LD byggs ur samma arrayer som texten på sidan,
 * så strukturerad data aldrig kan säga något annat än det besökaren läser.
 *
 * Priserna kommer från plan.md §1.13 (godkända 2026-09-13): Básico
 * ₲ 300.000/år, Plus ₲ 600.000/år. Ingen modulprissättning på sidan.
 */

export const PRICE_BAND = "desde ₲ 300.000 por año";

export type Feature = { title: string; body: string };

/** "Qué incluye" — vad kunden faktiskt får, inget påstående om kvalitet. */
export const FEATURES: Feature[] = [
  {
    title: "Una sola página, hecha para el celular",
    body: "Tu negocio en una pantalla: quién sos, qué hacés, dónde estás y cómo te escriben. Sin menús que nadie usa.",
  },
  {
    title: "Botón de WhatsApp en todas partes",
    body: "Arriba, en el medio y fijo abajo. El cliente toca y ya te está escribiendo, con el mensaje empezado.",
  },
  {
    title: "Horario con “abierto ahora”",
    body: "La página calcula sola si estás abierto y a qué hora cerrás, con el horario de Asunción.",
  },
  {
    title: "Mapa y dirección",
    body: "Tu zona y tu dirección con enlace a Google Maps, para el que va a ir hasta el local.",
  },
  {
    title: "Lista para Google",
    body: "Título, descripción y datos estructurados cargados desde el primer día, en la dirección sitio.com.py/tu-negocio.",
  },
  {
    title: "Estadísticas que se entienden",
    body: "Cuántos entraron y cuántos tocaron el botón de WhatsApp, últimos 30 días. Entrás con tu número y las ves.",
  },
];

export type Step = { n: string; title: string; body: string };

/** "Cómo funciona" — tre steg, inte fler. */
export const STEPS: Step[] = [
  {
    n: "01",
    title: "Hablamos por WhatsApp",
    body: "Nos contás qué hace tu negocio y te decimos qué plan te sirve. Sin reunión ni presupuesto que esperar.",
  },
  {
    n: "02",
    title: "Cargás tus datos y fotos",
    body: "Te mandamos un enlace privado: nombre, rubro, servicios, horario, dirección y de 3 a 8 fotos. Se llena desde el celular.",
  },
  {
    n: "03",
    title: "Publicamos en 48 h",
    body: "Te pasamos la página para revisar. Cuando decís que sí, queda publicada en sitio.com.py/tu-negocio.",
  },
];

export type Tier = {
  name: string;
  price: string;
  period: string;
  summary: string;
  includes: string[];
  featured?: boolean;
};

export const TIERS: Tier[] = [
  {
    name: "Básico",
    price: "₲ 300.000",
    period: "por año",
    summary: "La página completa, con todo lo que necesita un negocio para que lo encuentren y le escriban.",
    includes: [
      "Página en sitio.com.py/tu-negocio",
      "Diseño según tu rubro",
      "Logo y hasta 8 fotos",
      "WhatsApp, horario, mapa y redes",
      "Textos pulidos y datos para Google",
      "Estadísticas en /mi-sitio",
    ],
    featured: true,
  },
  {
    name: "Plus",
    price: "₲ 600.000",
    period: "por año",
    summary: "Todo lo del Básico, más el espacio para mostrar lo que vendés o lo que servís.",
    includes: [
      "Todo lo del plan Básico",
      "Galería de hasta 20 fotos",
      "Menú con precios (gastronomía)",
      "Catálogo de productos (comercio)",
      "El resto de los rubros suma la galería",
    ],
  },
];

export type Faq = { q: string; a: string };

/** Exakt fem. Samma array matar både sidan och FAQPage-JSON-LD. */
export const FAQS: Faq[] = [
  {
    q: "¿Qué necesito para empezar?",
    a: "El nombre de tu negocio, el número de WhatsApp con el que vendés, tu dirección o zona, el horario y entre 3 y 8 fotos. Las fotos del celular sirven; si no tenés, te decimos cuáles sacar.",
  },
  {
    q: "¿Cuánto tarda en estar publicada?",
    a: "48 horas hábiles desde que mandás los datos y las fotos. Antes de publicar te pasamos un enlace de revisión para que la veas y pidas cambios.",
  },
  {
    q: "¿Puedo cambiar los textos y las fotos después?",
    a: "Sí. Entrás a sitio.com.py/mi-sitio con tu número de WhatsApp y editás textos, fotos y horario cuando quieras. El diseño no se toca, así la página no se rompe.",
  },
  {
    q: "¿Necesito comprar un dominio o pagar hosting?",
    a: "No. Tu página vive en sitio.com.py/tu-negocio y el precio del año incluye el alojamiento. Si más adelante querés tu propio dominio, lo hablamos aparte.",
  },
  {
    q: "¿Qué pasa cuando se cumple el año?",
    a: "Te avisamos antes del vencimiento y renovás por el precio de tu plan. Si no renovás, la página se pausa y tus datos quedan guardados por si volvés.",
  },
];

/** Organization-JSON-LD. `waHref` är null när säljnumret saknas i env. */
export function organizationJsonLd(siteUrl: string, salesWhatsapp: string | null) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "sitio.com.py",
    url: siteUrl,
    description:
      "Páginas web de una sola pantalla, con WhatsApp, horario y mapa, para negocios de Paraguay. Desde ₲ 300.000 por año.",
    areaServed: { "@type": "Country", name: "Paraguay" },
    ...(salesWhatsapp
      ? {
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "sales",
              telephone: salesWhatsapp,
              availableLanguage: ["es-PY", "es"],
            },
          ],
        }
      : {}),
  };
}

/** FAQPage-JSON-LD ur FAQS — fem Question, aldrig fler eller färre. */
export function faqJsonLd(faqs: Faq[] = FAQS) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export const REGISTRO_CTA = { href: "/registro", label: "Crear mi página" };
