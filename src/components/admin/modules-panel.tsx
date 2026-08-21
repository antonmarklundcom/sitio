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
      <SectionTitle hint="Modulerna är upsellen. Att slå på en är en flagga, inte en migrering — och den syns på kundsajten så fort ISR-cachen släppt.">
        Moduler
      </SectionTitle>

      {overBaseLimit ? (
        <div className="mb-4">
          <Notice tone="warn">
            Sajten har {photoCount} foton men galleriet är av: temat visar bara de första, och nya
            uppladdningar nekas tills antalet är under {MAX_PHOTOS_BASE}. Slå på galleriet eller
            rensa bland bilderna.
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
                  {enabled ? <Badge tone="ok">På</Badge> : <Badge>Av</Badge>}
                  {built ? null : <Badge tone="warn">ej byggt än ({meta.plannedIn})</Badge>}
                </div>
                <p className="mt-1 text-sm text-admin-muted">{meta.summary}</p>
                <p className="mt-0.5 text-xs text-admin-muted">{meta.effect}</p>
                {enabled && state?.enabledAt ? (
                  <p className="mt-1 text-xs text-admin-muted">
                    Aktiverad {new Date(state.enabledAt).toLocaleDateString("sv-SE")} — perioden räknas därifrån.
                  </p>
                ) : null}
                {meta.key === "gallery" ? (
                  <p className="mt-1 text-xs text-admin-muted">
                    Fototak just nu: {photoCount}/{enabled ? MAX_PHOTOS_GALLERY : MAX_PHOTOS_BASE}.
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
                  {enabled ? "Stäng av" : "Slå på"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
