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

Minsta avstånd mellan varianternas hue: **157°** (29 → 186). Alla kontraster
ligger långt över WCAG AA för brödtext (4,5:1).

### Tema `gastronomia` (WARM CRAFT, ljus-varm)

| Variant | Accent | Hue | Bas | Ink/bas | Accent/bas | Muted/bas |
|---|---|---|---|---|---|---|
| 1 | `#B23A20` | 11° | `#FBF5EE` | 15,73:1 | 5,51:1 | 6,08:1 |
| 2 | `#7A6B10` | 52° | `#FAF7EC` | 15,34:1 | 4,97:1 | 5,90:1 |

Minsta avstånd mellan varianternas hue: **41°** (11 → 52). Lägsta uppmätta
kontrast i temat är accent mot `--surface` (4,46:1 i variant 2) — över AA för
brödtext.

### Tema `comercio` (EDITORIAL, ljusdominant)

| Variant | Accent | Hue | Bas | Ink/bas | Accent/bas | Muted/bas |
|---|---|---|---|---|---|---|
| 1 | `#0E4E96` | 212° | `#F7F8FA` | 16,77:1 | 7,75:1 | 5,93:1 |
| 2 | `#0A6E52` | 163° | `#F5F9F7` | 16,74:1 | 5,88:1 | 6,34:1 |

Minsta avstånd mellan varianternas hue: **49°** (163 → 212).

### Tema `salud` (CALM, ljusdominant — turno-verksamheter: `salud` + `belleza`)

| Variant | Accent | Hue | Bas | Ink/bas | Accent/bas | Muted/bas | Låst till |
|---|---|---|---|---|---|---|---|
| 1 | `#0B6B62` | 174° | `#F3F8F7` | 15,62:1 | 5,95:1 | 5,61:1 | `salud` |
| 2 | `#93275F` | 329° | `#F8F4F6` | 15,86:1 | 7,14:1 | 6,23:1 | `belleza` |

Minsta avstånd mellan varianternas hue: **155°** (174 → 329).
Alla värden är beräknade (sRGB-relativluminans, WCAG-formeln), inte skattade.
Variant 1 (teal) är låst till kategori `salud`, variant 2 (rose) till
`belleza` (plan §1.11).

Ljus, sval-neutral bas med en svag blågrön ton i båda varianterna — det är
`salud`s "CALM"-spår, inte en per-variant nyans som i `gastronomia`/`comercio`.
Ingen grain (design §6.2), 12 px basradie (`--r-md`), CTA/status/länk är de
enda tre ställena accenten får synas.

### Sektion → mönster per tema (portföljregeln)

Två sajter i registret får inte dela sektion→mönster-karta. Teman är därför
kartlagda var för sig:

| Tema | 01 | 02 | 03 | 04 | 05 | 06 | 07 |
|---|---|---|---|---|---|---|---|
| `servicios` | P1 | P8 | P3 | P5 | P4 | P6 | P9 |
| `gastronomia` | P6 | P8 | P4 | P3 | P7 | P1 | P9 |
| `comercio` | P2 | P8 | P3 | P4 | P6 | P7 | P9 |
| `salud` | P1 | P6 | P3 | P4 | P8 | P9 | — |

`salud` har sex nummer­rade sektioner, inte sju (plus den villkorade menyn,
onumrerad som i övriga teman) — se `src/themes/salud/salud-theme.tsx`s
header­kommentar. Positionerna är medvetet omkastade mot de andra tre: bildblocket
(P6) ligger direkt efter hero i stället för sist, och trust-ribbon (P8) ligger
sent i stället för näst först. Hero (P1) bär själv ingen bild — splitten är
text mot ett schemakort — så P6 förblir det enda stora bildmomentet.

### Kända avvikelser

**40°-regeln gäller inom varje tema, inte mellan teman.** Registret har
fyra teman med två varianter vardera. Tema och variant härleds från kategori
via `presentationFor`; de väljs inte manuellt vid publicering.

Det tätaste paret **mellan** teman är `comercio` v2 (163°, `#0A6E52`) och
`salud` v1 (174°, `#0B6B62`), med 11° avstånd. Färgvärdena är oförändrade.

## Att fylla i

Övriga domäner i portföljen (byggmedia.se, propia.com.py, educacion.com.py
m.fl.) är inte inventerade här. Det kräver en genomgång av de live-sajterna och
är inte gjort — tills det är gjort går det inte att garantera att sitios
accenter inte krockar med en befintlig sajt.
