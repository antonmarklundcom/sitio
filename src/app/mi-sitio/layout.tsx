import "@/styles/panel.css";

export const metadata = {
  // Owner-adminet är privat och ska aldrig indexeras.
  robots: { index: false, follow: false },
};

export default function MiSitioLayout({ children }: { children: React.ReactNode }) {
  return <div className="panel">{children}</div>;
}
