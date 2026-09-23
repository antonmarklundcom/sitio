import { headers } from "next/headers";
import { requireRole } from "@/lib/auth";
import { clientIp } from "@/lib/analytics";
import { CLIENT_IP_SOURCES, clientIpFrom, clientIpSource } from "@/lib/client-ip";
import { checkUploads, dbClock, envPresence, pickHeaders } from "@/lib/diagnostics";
import { env } from "@/lib/env";
import { Badge, Card, SectionTitle } from "@/components/admin/ui";

// Varje besök mäter på nytt: headers, databasens klocka och en skrivprobe.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Diagnóstico", robots: { index: false, follow: false } };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-admin-line last:border-0">
      <th scope="row" className="w-56 px-3 py-2 text-left align-top font-mono text-xs font-normal text-admin-muted">{label}</th>
      <td className="px-3 py-2 font-mono text-xs break-all text-admin-text">{children}</td>
    </tr>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-admin-line">
      <table className="w-full border-collapse text-sm"><tbody>{children}</tbody></table>
    </div>
  );
}

function YesNo({ ok, yes = "sí", no = "no" }: { ok: boolean; yes?: string; no?: string }) {
  return <Badge tone={ok ? "ok" : "warn"}>{ok ? yes : no}</Badge>;
}

export default async function DiagnosticoPage() {
  await requireRole("superadmin");
  const hdrs = await headers();
  const [clock, uploads] = await Promise.all([dbClock(), checkUploads()]);
  const offset = env.analyticsTzOffsetHours;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Diagnóstico</h1>
        <p className="mt-1 text-sm text-admin-muted">
          Lo que solo se puede medir en el servidor real. Nada de esta página guarda datos; las claves se muestran solo como sí/no.
        </p>
      </div>

      <Card>
        <SectionTitle hint="Qué deja pasar el proxy de Hostinger. Decide en qué IP se basan los límites de intentos (R3-27): la fuente correcta es la que muestra tu IP real aunque mandes una x-forwarded-for inventada.">
          Cabeceras de la solicitud
        </SectionTitle>
        <Table>
          {pickHeaders(hdrs).map((h) => (
            <Row key={h.name} label={h.name}>{h.value ?? <span className="text-admin-muted">—</span>}</Row>
          ))}
          <Row label="clientIp() hoy">
            {clientIp(hdrs)} <span className="text-admin-muted">(CLIENT_IP_SOURCE = {clientIpSource()})</span>
          </Row>
          {CLIENT_IP_SOURCES.map((source) => (
            <Row key={source} label={`si fuera ${source}`}>{clientIpFrom(hdrs, source)}</Row>
          ))}
        </Table>
      </Card>

      <Card>
        <SectionTitle hint={`Las estadísticas diarias usan ANALYTICS_TZ_OFFSET_HOURS = ${offset}, que supone una base en UTC. Si now() y utc_timestamp() difieren, hay que ajustarlo.`}>
          Base de datos
        </SectionTitle>
        {"error" in clock ? (
          <p className="text-sm text-admin-danger">{clock.error}</p>
        ) : (
          <Table>
            <Row label="version()">{clock.version}</Row>
            <Row label="now()">{clock.now}</Row>
            <Row label="utc_timestamp()">{clock.utcNow}</Row>
            <Row label="@@time_zone">{clock.timeZone}</Row>
            <Row label="@@system_time_zone">{clock.systemTimeZone}</Row>
            <Row label="now() − utc">
              {clock.offsetHours} h <YesNo ok={clock.offsetHours === 0} yes="en UTC, el desfase -3 es correcto" no="no está en UTC: revisar el desfase" />
            </Row>
          </Table>
        )}
      </Card>

      <Card>
        <SectionTitle hint="Se escribe y se borra un archivo temporal. Tiene que estar fuera de la carpeta de la app: el deploy la reescribe.">
          Carpeta de subidas
        </SectionTitle>
        <Table>
          <Row label="UPLOADS_DIR">{uploads.dir || "—"}</Row>
          <Row label="carpeta de la app">{uploads.cwd}</Row>
          <Row label="existe"><YesNo ok={uploads.exists} /></Row>
          <Row label="se puede escribir"><YesNo ok={uploads.writable} /></Row>
          <Row label="fuera de la app"><YesNo ok={uploads.exists && !uploads.insideApp} /></Row>
          {uploads.error ? <Row label="error">{uploads.error}</Row> : null}
        </Table>
      </Card>

      <Card>
        <SectionTitle hint="Solo si está configurada, nunca el valor. NEXT_PUBLIC_SALES_WHATSAPP muestra lo que quedó en el build.">
          Variables de entorno
        </SectionTitle>
        <Table>
          {envPresence(process.env).map((e) => (
            <Row key={e.name} label={e.name}><YesNo ok={e.set} /></Row>
          ))}
        </Table>
      </Card>
    </div>
  );
}
