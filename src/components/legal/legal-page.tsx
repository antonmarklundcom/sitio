import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { absoluteUrl, env } from "@/lib/env";
import { displayFont, textFont } from "@/themes/fonts";
import { salesContact } from "@/components/landing/sales-contact";
import "@/styles/landing.css";

/** Datum för båda sidorna. Uppdateras för hand när texten ändras. */
export const LEGAL_UPDATED = "29 de septiembre de 2026";

export function legalMetadata(path: string, title: string, description: string): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { type: "website", locale: "es_PY", url, siteName: "sitio.com.py", title, description },
    twitter: { card: "summary", title, description },
  };
}

/** Länk till WhatsApp-numret, eller vanlig text när numret saknas. */
export function LegalContact({ label }: { label: string }) {
  const contact = salesContact(env.salesWhatsapp);
  if (!contact.display) return <>{label}</>;
  return (
    <a href={contact.href} rel="noopener">
      {label} ({contact.display})
    </a>
  );
}

export function LegalPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className={`lp ${displayFont.variable} ${textFont.variable}`} lang="es-PY">
      <header className="lp-header">
        <div className="lp-wrap lp-header-inner">
          <Link href="/" className="lp-brand" style={{ textDecoration: "none" }}>
            sitio<span className="lp-brand-dim">.com.py</span>
          </Link>
        </div>
      </header>
      <main className="lp-section lp-legal">
        <div className="lp-wrap">
          <h1>{title}</h1>
          <p className="lp-lede">{lede}</p>
          <p className="lp-legal-date">
            <strong>Última actualización: {LEGAL_UPDATED}</strong>
          </p>
          {children}
        </div>
      </main>
      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <span>© {new Date().getFullYear()} sitio.com.py · Hecho en Paraguay</span>
          <span className="lp-footer-links">
            <Link href="/">Inicio</Link>
            <Link href="/terminos">Términos</Link>
            <Link href="/privacidad">Privacidad</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
