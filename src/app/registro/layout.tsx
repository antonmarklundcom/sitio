import "@/styles/panel.css";

export const metadata = { title: "Creá tu página", robots: { index: true, follow: true } };

export default function RegistroLayout({ children }: { children: React.ReactNode }) {
  return <div className="panel">{children}</div>;
}
