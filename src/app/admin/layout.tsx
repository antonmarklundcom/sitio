import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "sitio admin", template: "%s – sitio admin" },
  robots: { index: false, follow: false },
};

/** Yttre adminlayout: bara färg och metadata. Chromet ligger i (dashboard). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-admin-bg text-admin-text">{children}</div>;
}
