import Link from "next/link";

export default function SiteNotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "#12100D",
        color: "#F4EFE8",
        textAlign: "center",
      }}
    >
      <div>
        <p style={{ letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "0.8125rem", color: "#A79E92" }}>
          Error 404
        </p>
        <h1 style={{ fontSize: "clamp(2rem, 6vw, 3rem)", margin: "0.5rem 0 1rem", letterSpacing: "-0.03em" }}>
          Esta página no existe
        </h1>
        <p style={{ color: "#A79E92", margin: "0 auto 1.5rem", maxWidth: "40ch" }}>
          El enlace puede estar mal escrito, o la página ya no está disponible.
        </p>
        <Link href="/" style={{ color: "#FF8A1F" }}>
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
