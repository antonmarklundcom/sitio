/**
 * Telefonmocken i hero: en handbyggd, statisk kopia av `servicios`-temats
 * markup (hero → ribbon → tjänstekort → wa-dock) i temats variant 1, nedskalad
 * i en CSS-telefonram.
 *
 * Medvetet handbyggd i stället för importerad från `src/themes/servicios`:
 * temat tar en `ThemeProps` med riktiga media-rader och renderar `SiteImage`,
 * som pekar på `/media/...` i databasen. Landningssidan är statisk och rör
 * aldrig databasen (plan.md §1.4), så mocken bär sina egna klasser och sin
 * egen demo-data.
 *
 * `aria-hidden`: det här är en illustration av en annan sajt. Bildtexten
 * under ramen är den tillgängliga beskrivningen.
 */
export function PhoneMock() {
  return (
    <figure className="lp-phone-wrap">
      <div className="lp-phone" aria-hidden="true">
        <div className="lp-phone-screen">
          <div className="lp-demo">
            <div className="lp-demo-bar">
              <span className="lp-demo-url">sitio.com.py/frio-sur</span>
            </div>

            <div className="lp-demo-head">
              <span className="lp-demo-name">Frío Sur</span>
              <span className="lp-demo-call">Llamar</span>
            </div>

            <div className="lp-demo-hero">
              <span className="lp-demo-eyebrow">Lambaré, Central</span>
              <p className="lp-demo-h1">
                Frío Sur, aire acondicionado en Lambaré
              </p>
              <p className="lp-demo-lede">
                Instalación, carga de gas y service de split. Trabajamos en Lambaré,
                Villa Elisa y San Lorenzo.
              </p>
              <span className="lp-demo-cta">Pedir presupuesto por WhatsApp</span>
              <span className="lp-demo-status">
                <span className="lp-demo-dot" />
                Abierto ahora · cierra 18:00
              </span>
            </div>

            <div className="lp-demo-ribbon">
              <span>LAMBARÉ</span>
              <span>ABIERTO AHORA</span>
              <span>PRESUPUESTO SIN CARGO</span>
            </div>

            <div className="lp-demo-services">
              <span className="lp-demo-eyebrow">Servicios</span>
              <div className="lp-demo-card lp-demo-card--lead">
                <span className="lp-demo-card-title">Instalación de split</span>
                <span className="lp-demo-card-body">
                  Equipo nuevo o traslado, con soporte y prueba de funcionamiento.
                </span>
              </div>
              <div className="lp-demo-card">
                <span className="lp-demo-card-title">Carga de gas</span>
              </div>
              <div className="lp-demo-card">
                <span className="lp-demo-card-title">Service y limpieza</span>
              </div>
              <div className="lp-demo-card">
                <span className="lp-demo-card-title">Mantenimiento por contrato</span>
              </div>
            </div>

            <div className="lp-demo-hours">
              <span className="lp-demo-hours-row">
                <span>Lun–Vie</span>
                <span>08:00–18:00</span>
              </span>
              <span className="lp-demo-hours-row">
                <span>Sábado</span>
                <span>08:00–12:00</span>
              </span>
            </div>

            <p className="lp-demo-zone">
              Atendemos en <strong>Lambaré, Villa Elisa y San Lorenzo</strong>.
              Av. Cacique Lambaré 1240 · Ver en el mapa
            </p>

            <div className="lp-demo-foot">
              <span>© 2026 Frío Sur · RUC 80012345-6</span>
              <span>Instagram</span>
            </div>

            <div className="lp-demo-dock">Pedir presupuesto</div>
          </div>
        </div>
      </div>
      <figcaption className="lp-phone-caption">
        Ejemplo de página publicada: un negocio de servicios, con el botón de
        WhatsApp, el horario y la zona de trabajo.
      </figcaption>
    </figure>
  );
}
