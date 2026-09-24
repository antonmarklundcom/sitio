import "@/styles/panel.css";

export const metadata = {
  title: "Mis ventas",
  // Personlig sida (token i länken) — aldrig indexerad.
  robots: { index: false, follow: false },
};

export default function SocioLayout({ children }: { children: React.ReactNode }) {
  return <div className="panel">{children}</div>;
}
