/**
 * Telefonmocken i hero: en handbyggd, statisk kopia av `servicios`-temats
 * "placa"-mönster i variant 1 (ámbar), nedskalad i en CSS-telefonram.
 *
 * Medvetet handbyggd i stället för importerad från `src/themes/servicios`:
 * temat tar en `ThemeProps` med riktiga media-rader och renderar `SiteImage`,
 * som pekar på `/media/...` i databasen. Landningssidan är statisk och rör
 * aldrig databasen (plan.md §1.4), så mocken bär sina egna klasser och sin
 * egen demo-data.
 *
 * Den måste följa temat när temat ändras — annars säljer landningssidan en
 * sajt vi inte längre bygger. Ordningen här är temats: bildyta med namnrad →
 * platta med rubrik, status och WhatsApp-knapp → tjänstelista → horario →
 * mörkt avslutsband → fast knapp.
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

            <div className="lp-demo-photo">
              <div className="lp-demo-head">
                <span className="lp-demo-name">Frío Sur</span>
                <span className="lp-demo-call">Llamar</span>
              </div>
            </div>

            <div className="lp-demo-plate">
              <span className="lp-demo-eyebrow">Lambaré, Central</span>
              <p className="lp-demo-h1">Frío Sur, aire acondicionado en Lambaré</p>
              <p className="lp-demo-lede">
                Instalación, carga de gas y service de split.
              </p>
              <span className="lp-demo-status">
                <span className="lp-demo-dot" />
                Abierto ahora · cierra 18:00
              </span>
              <span className="lp-demo-cta">Pedir presupuesto</span>
              <span className="lp-demo-sub">Te respondemos al +595 981 555 123</span>
              <span className="lp-demo-chips">
                <span className="lp-demo-chip">Presupuesto sin cargo</span>
              </span>
            </div>

            <div className="lp-demo-svc">
              <span className="lp-demo-eyebrow">Servicios</span>
              <span className="lp-demo-svc-h2">Lo que hacemos</span>
              <span className="lp-demo-svc-row">
                <span className="lp-demo-svc-n">01</span>
                <span className="lp-demo-svc-name">Instalación de split</span>
              </span>
              <span className="lp-demo-svc-row">
                <span className="lp-demo-svc-n">02</span>
                <span className="lp-demo-svc-name">Carga de gas</span>
              </span>
              <span className="lp-demo-svc-row">
                <span className="lp-demo-svc-n">03</span>
                <span className="lp-demo-svc-name">Service y limpieza</span>
              </span>
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

            <div className="lp-demo-close">
              <span className="lp-demo-statement">¿Lo arreglamos esta semana?</span>
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
