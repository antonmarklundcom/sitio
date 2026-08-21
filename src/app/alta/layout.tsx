import "./alta.css";

export const metadata = {
  // Intake-länkarna är personliga och ska aldrig indexeras.
  robots: { index: false, follow: false },
};

export default function AltaLayout({ children }: { children: React.ReactNode }) {
  return <div className="alta">{children}</div>;
}
