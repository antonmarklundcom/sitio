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

### Tema `gastronomia` (WARM CRAFT, ljus-varm)

| Variant | Accent | Hue | Bas | Ink/bas | Accent/bas | Muted/bas |
|---|---|---|---|---|---|---|
| 1 | `#B23A20` | 11° | `#FBF5EE` | 15,73:1 | 5,51:1 | 6,08:1 |
| 2 | `#7A6B10` | 52° | `#FAF7EC` | 15,34:1 | 4,97:1 | 5,90:1 |
| 3 | `#1C7A4A` | 149° | `#F4F8F3` | 15,58:1 | 4,98:1 | 6,01:1 |
| 4 | `#96177A` | 313° | `#FCF4F8` | 16,03:1 | 6,84:1 | 6,37:1 |

Minsta avstånd mellan varianternas hue: **41°** (11 → 52). Lägsta uppmätta
kontrast i temat är accent mot `--surface` (4,46:1 i variant 2) — över AA för
brödtext.

### Tema `comercio` (EDITORIAL, ljusdominant)

| Variant | Accent | Hue | Bas | Ink/bas | Accent/bas | Muted/bas |
|---|---|---|---|---|---|---|
| 1 | `#0E4E96` | 212° | `#F7F8FA` | 16,77:1 | 7,75:1 | 5,93:1 |
| 2 | `#0A6E52` | 163° | `#F5F9F7` | 16,74:1 | 5,88:1 | 6,34:1 |
| 3 | `#7A2FBF` | 271° | `#F8F6FB` | 16,77:1 | 6,34:1 | 6,62:1 |
| 4 | `#8C5304` | 35° | `#FAF7F2` | 16,24:1 | 5,54:1 | 6,42:1 |

Minsta avstånd mellan varianternas hue: **49°** (163 → 212).

### Sektion → mönster per tema (portföljregeln)

Två sajter i registret får inte dela sektion→mönster-karta. Teman är därför
kartlagda var för sig:

| Tema | 01 | 02 | 03 | 04 | 05 | 06 | 07 |
|---|---|---|---|---|---|---|---|
| `servicios` | P1 | P8 | P3 | P5 | P4 | P6 | P9 |
| `gastronomia` | P6 | P8 | P4 | P3 | P7 | P1 | P9 |
| `comercio` | P2 | P8 | P3 | P4 | P6 | P7 | P9 |

### Kända avvikelser

**40°-regeln kan inte hålla över hela produkten.** Sex teman × fyra varianter
är 24 accenter; 24 hues med 40° mellanrum ryms inte i 360°. Det är en medveten
avvikelse, dokumenterad i `PLAN.md` §1.5: regeln upprätthålls **inom** ett
tema, och kollisioner mellan teman syns bara om två grannar i samma bransch
får samma tema och variant — variant väljs manuellt vid publicering.

Efter PR-07 är de tätaste paren **mellan** teman `servicios` v1 (29°, `#FF8A1F`)
och `comercio` v4 (35°, `#8C5304`), samt `servicios` v4 (254°) och `comercio` v3
(271°). Båda paren skiljer sig i spår (mörkdominant INDUSTRIAL mot ljus
EDITORIAL) och i ljushet — accenterna delar hue-region men aldrig utseende.
Det är avsiktligt och inte en miss; tvinga inte isär dem utan att först mäta
kontrasterna om igen.

## Att fylla i

Övriga domäner i portföljen (byggmedia.se, propia.com.py, educacion.com.py
m.fl.) är inte inventerade här. Det kräver en genomgång av de live-sajterna och
är inte gjort — tills det är gjort går det inte att garantera att sitios
accenter inte krockar med en befintlig sajt.
