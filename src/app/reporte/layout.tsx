import "@/styles/panel.css";

export const metadata = {
  // Rapporten är personlig (token i länken) och ska aldrig indexeras.
  robots: { index: false, follow: false },
};

export default function ReporteLayout({ children }: { children: React.ReactNode }) {
  return <div className="panel">{children}</div>;
}
