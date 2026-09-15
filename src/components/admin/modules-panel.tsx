import { MAX_PHOTOS_BASE, MAX_PHOTOS_GALLERY } from "@/lib/media-shared";
import { MODULES, isModuleBuilt } from "@/lib/modules";
import type { ModuleState } from "@/db/module-queries";
import { Badge, Card, Notice, SectionTitle } from "./ui";

/**
 * Modulväxeln per kund. Svenska: superadmin-UI.
 *
 * Hela registret listas, även moduler som ännu inte är byggda — flaggan och
 * faktureringen får ligga före implementationen, men växeln säger då rakt ut
 * att den inte gör något än, precis som temaväljaren gör med teman som saknas.
 */
export function ModulesPanel({
  businessId,
  modules,
  photoCount,
  toggleModule,
}: {
  businessId: number;
  modules: ModuleState[];
  photoCount: number;
  toggleModule: (formData: FormData) => Promise<void>;
}) {
  const gallery = modules.find((m) => m.key === "gallery");
  const overBaseLimit = !gallery?.enabled && photoCount > MAX_PHOTOS_BASE;

  return (
    <Card>
      <SectionTitle hint="Los módulos son servicios adicionales. Se activan con una opción, sin migraciones, y aparecen en el sitio del cliente cuando se actualiza la caché ISR.">
        Módulos
      </SectionTitle>

      {overBaseLimit ? (
        <div className="mb-4">
          <Notice tone="warn">
            El sitio tiene {photoCount} fotos pero la galería está desactivada: el tema muestra solo las primeras y las nuevas
            cargas se rechazan hasta que la cantidad sea menor a {MAX_PHOTOS_BASE}. Activá la galería o
            eliminá algunas imágenes.
          </Notice>
        </div>
      ) : null}

      <ul className="divide-y divide-admin-line">
        {MODULES.map((meta) => {
          const state = modules.find((m) => m.key === meta.key);
          const enabled = state?.enabled ?? false;
          const built = isModuleBuilt(meta.key);

          return (
            <li key={meta.key} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-[16rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">{meta.label}</h3>
                  <code className="text-xs text-admin-muted">{meta.key}</code>
                  {enabled ? <Badge tone="ok">Activado</Badge> : <Badge>Desactivado</Badge>}
                  {built ? null : <Badge tone="warn">Todavía no está ({meta.plannedIn})</Badge>}
                </div>
                <p className="mt-1 text-sm text-admin-muted">{meta.summary}</p>
                <p className="mt-0.5 text-xs text-admin-muted">{meta.effect}</p>
                {enabled && state?.enabledAt ? (
                  <p className="mt-1 text-xs text-admin-muted">
                    Activado {new Date(state.enabledAt).toLocaleDateString("sv-SE")} — el período se cuenta desde esa fecha.
                  </p>
                ) : null}
                {meta.key === "gallery" ? (
                  <p className="mt-1 text-xs text-admin-muted">
                    Límite actual de fotos: {photoCount}/{enabled ? MAX_PHOTOS_GALLERY : MAX_PHOTOS_BASE}.
                  </p>
                ) : null}
              </div>

              <form action={toggleModule}>
                <input type="hidden" name="businessId" value={businessId} />
                <input type="hidden" name="moduleKey" value={meta.key} />
                <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
                <button
                  type="submit"
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    enabled
                      ? "border border-admin-line bg-admin-surface-2 text-admin-text hover:border-admin-muted"
                      : "bg-admin-accent text-white hover:opacity-90"
                  }`}
                >
                  {enabled ? "Desactivar" : "Activar"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
