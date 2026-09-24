"use client";

import { useActionState } from "react";
import type { SiteOptions } from "@/lib/growth";
import type { SiteOptionsState } from "@/app/mi-sitio/growth-actions";

/**
 * "Opciones de tu página" (growth-1): kundens egna av/på-val. Spanska (voseo).
 */
export function OwnerSiteOptions({
  options,
  googleReviewUrl,
  booking,
  readOnly,
  save,
}: {
  options: SiteOptions;
  googleReviewUrl: string;
  booking: boolean;
  readOnly: boolean;
  save: (state: SiteOptionsState, formData: FormData) => Promise<SiteOptionsState>;
}) {
  const [state, action, pending] = useActionState(save, {});
  return (
    <div className="panel-card" id="opciones">
      <h2>Opciones de tu página</h2>
      {state.ok ? <p className="panel-note panel-note--ok">{state.ok}</p> : null}
      {state.error ? <p className="panel-note panel-note--err">{state.error}</p> : null}
      <form action={action}>
        <fieldset disabled={readOnly || pending} className="panel-toggles">
          <label className="panel-toggle">
            <input type="checkbox" name="leadForm" defaultChecked={options.leadForm} />
            <span>
              <strong>Formulario “Dejanos tu número”</strong>
              <span className="hint">
                {booking
                  ? "Tu página muestra el pedido de turnos (plan Pro); este interruptor no lo apaga."
                  : "Para el cliente que prefiere que le escribas vos. Las consultas llegan a “Consultas”, arriba."}
              </span>
            </span>
          </label>
          <label className="panel-toggle">
            <input type="checkbox" name="reviewButton" defaultChecked={options.reviewButton} />
            <span>
              <strong>Botón “Dejanos una reseña en Google”</strong>
              <span className="hint">Más reseñas = más arriba en Google Maps. Necesita el enlace de abajo.</span>
            </span>
          </label>
          <div className="panel-field">
            <label htmlFor="googleReviewUrl">Enlace para pedir reseñas</label>
            <input
              id="googleReviewUrl"
              name="googleReviewUrl"
              type="url"
              inputMode="url"
              maxLength={300}
              defaultValue={googleReviewUrl}
              placeholder="https://g.page/r/…/review"
              aria-invalid={!!state.fieldErrors?.googleReviewUrl}
            />
            <p className="hint">En tu Perfil de Google: “Pedir reseñas” → copiá el enlace y pegalo acá.</p>
            {state.fieldErrors?.googleReviewUrl ? <p className="err">{state.fieldErrors.googleReviewUrl}</p> : null}
          </div>
          <label className="panel-toggle">
            <input type="checkbox" name="credit" defaultChecked={options.credit} />
            <span>
              <strong>“Hecho con sitio.com.py” al pie de la página</strong>
              <span className="hint">Si otro negocio crea su página desde ese enlace, cuenta como recomendación tuya.</span>
            </span>
          </label>
          {readOnly ? null : (
            <div className="panel-actions">
              <button type="submit" className="panel-btn">
                {pending ? "Guardando…" : "Guardar opciones"}
              </button>
            </div>
          )}
        </fieldset>
      </form>
    </div>
  );
}
