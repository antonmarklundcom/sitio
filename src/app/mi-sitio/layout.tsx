import "@/styles/panel.css";

export const metadata = {
  // Owner-adminet är privat och ska aldrig indexeras.
  robots: { index: false, follow: false },
  // Avisos (crm-1): installerbar på hemskärmen, krävs på iOS för Web Push.
  manifest: "/mi-sitio.webmanifest",
  appleWebApp: { capable: true, title: "Mi sitio", statusBarStyle: "default" as const },
  icons: { apple: "/mi-sitio-icon-192.png" },
};

export const viewport = { themeColor: "#0f6f4f" };

export default function MiSitioLayout({ children }: { children: React.ReactNode }) {
  return <div className="panel">{children}</div>;
}
