import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { baseUrl } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  // Delningskortet (opengraph-image.tsx i samma segment) blir en relativ URL
  // som löses mot denna bas; utan den faller Next tillbaka på localhost:3000.
  metadataBase: new URL(baseUrl()),
  title: "sitio.com.py — páginas web para negocios de Paraguay",
  description:
    "Una página de una sola pantalla con WhatsApp, horario y mapa para tu negocio. Publicada en 48 h, desde ₲ 300.000 por año.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PY">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
