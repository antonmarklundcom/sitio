import { exportLeads, resolveCrmScope } from "@/db/crm-queries";
import { leadsToCsv } from "@/lib/crm";
import { todayAsuncion } from "@/lib/billing";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * CSV de los clientes del negocio (crm-1). El middleware ya exige sesión de
 * owner/superadmin en /mi-sitio/*; acá se vuelve a comprobar y el negocio sale
 * de la SESIÓN (superadmin: ?sitio=, solo lectura). UTF-8 con BOM para Excel.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user?.userId) return new Response("No autorizado", { status: 401 });
  if (user.role !== "owner" && user.role !== "superadmin") return new Response("Prohibido", { status: 403 });

  const sitio = new URL(req.url).searchParams.get("sitio");
  const scope = await resolveCrmScope(sitio);
  if (!scope) return new Response("Negocio no encontrado", { status: 404 });

  const rows = await exportLeads(scope.business.id);
  return new Response(leadsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${scope.business.slug}-${todayAsuncion()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
