# Palett- och typsnittsregister

> Krävs av `web-design-system`-skillen (Step 1). Varje accent och display-snitt
> som är i drift ska stå här, så att nästa build kan kontrollera avståndet.

## sitio.com.py — kundsajternas teman

Display: **Bricolage Grotesque** (500/600) · Text: **Inter Tight** (400/500/600).
Valda för att de inte är portföljens vanliga Inter/Oswald — tre sajter med
samma display-snitt är exakt den sameness registret finns för att stoppa.

### Tema `servicios` (INDUSTRIAL, mörkdominant)

| Variant | Accent | Hue | Bas | Ink/bas | Accent/bas |
|---|---|---|---|---|---|
| 1 | `#FF8A1F` | 29° | `#12100D` | 16,60:1 | 8,06:1 |
| 2 | `#2ACADC` | 186° | `#0B1214` | 16,63:1 | 9,52:1 |
| 3 | `#C7E63C` | 71° | `#101207` | 16,68:1 | 13,33:1 |
| 4 | `#A78BFF` | 254° | `#0E0C14` | 16,40:1 | 7,19:1 |

Minsta avstånd mellan varianternas hue: **42°** (29 → 71). Alla kontraster
ligger långt över WCAG AA för brödtext (4,5:1).

### Kända avvikelser

**40°-regeln kan inte hålla över hela produkten.** Sex teman × fyra varianter
är 24 accenter; 24 hues med 40° mellanrum ryms inte i 360°. Det är en medveten
avvikelse, dokumenterad i `PLAN.md` §1.5: regeln upprätthålls **inom** ett
tema, och kollisioner mellan teman syns bara om två grannar i samma bransch
får samma tema och variant — variant väljs manuellt vid publicering.

## Att fylla i

Övriga domäner i portföljen (byggmedia.se, propia.com.py, educacion.com.py
m.fl.) är inte inventerade här. Det kräver en genomgång av de live-sajterna och
är inte gjort — tills det är gjort går det inte att garantera att sitios
accenter inte krockar med en befintlig sajt.
