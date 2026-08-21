import { formatGs } from "@/lib/format";
import type { MenuSectionRow } from "@/db/menu-queries";

/**
 * Menyn (menu-modulen, PR-13). Delad sektionsprimitiv: markupen är densamma i
 * alla teman och stilarna ligger i `theme.css`, så ett tema som inte har byggt
 * ett eget mönster för menyn ändå får en meny som ser avsiktlig ut. Varje tema
 * får skruva utseendet med `.t-<tema> .site-menu …`.
 *
 * `data-ev-view="menu_view"` läses av beaconen och skickas en gång när
 * sektionen faktiskt syns. Ett klickevent hade inte gått att använda: en meny
 * läses, den klickas inte.
 */
export function SiteMenu({
  menu,
  eyebrow = "La carta",
  title,
  intro,
}: {
  menu: MenuSectionRow[];
  eyebrow?: string;
  title: string;
  intro?: string;
}) {
  if (menu.length === 0) return null;

  return (
    <section id="carta" className="site-menu" data-ev-view="menu_view">
      <div className="wrap">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="reveal">{title}</h2>
        {intro ? <p className="site-menu-intro">{intro}</p> : null}

        {menu.map((section) => (
          <div key={section.id} className="site-menu-section reveal">
            <h3>{section.name}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item.id}>
                  <div className="site-menu-item-head">
                    <span className="site-menu-item-name">{item.name}</span>
                    {/* Prickraden binder ihop namn och pris på en bred skärm.
                        Den är dekor och därför aria-hidden — en skärmläsare
                        ska läsa "Empanada, 8.000 ₲", inte punkterna. */}
                    <span className="site-menu-dots" aria-hidden="true" />
                    <span className="site-menu-price">{formatGs(item.priceGs)}</span>
                  </div>
                  {item.description ? <p>{item.description}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
