# Palett- och typsnittsregister

> Krävs av `web-design-system`-skillen (Step 1). Varje accent och display-snitt
> som är i drift ska stå här, så att nästa build kan kontrollera avståndet.

Alla kontrastvärden nedan är **beräknade** (sRGB-relativluminans, WCAG-formeln)
ur `src/themes/palettes.ts`, inte skattade.

## sitio.com.py — kundsajternas teman ("Placa", v2)

Display: **Archivo** (600/700) · Text: **Instrument Sans** (400/500/600).

Bytte från Bricolage Grotesque / Inter Tight i placa-omgången:

- **Inter Tight är Inter** med smalare spårning, och Inter är portföljens
  vanligaste brödtextsnitt. Det är exakt den sameness registret finns för att
  stoppa — bara ett steg bortflyttad.
- **Archivo** bär sidans viktigaste rad (företagsnamnet, satt stort och tight
  på 360 px). Dess smala apertur och höga x-höjd håller ihop där Bricolages
  bredare former spricker, och den läser som skyltning — vilket är vad en
  företagsnamnrubrik ska göra.

Typskala ratio **1,25**, bas 17 px. Rubrikernas radavstånd är **1,08** och
inte tightare: spanska rubriker bär tilde och accenter på varje rad (Ñ, á, ó),
och vid 1,04 krockade Ñ:ets tilde med raden ovanför.

### Accenten är tre tokens, inte en (typändring mot v1)

`Palette` har i v2 fälten `accent`, `accentInk`, `accentLight` och `deep`
utöver v1:s uppsättning. Skälet är konkret: när alla fyra teman är ljusa
tvingade en enda accent-token fram ett omöjligt val — samma färg skulle både
bära text som fyllning OCH klara 4,5:1 som liten text mot en ljus bas. En
signalorange klarar det första men aldrig det andra, så v1 fick en
brun-dämpad "orange" som inte läste som orange.

| Token | Används till | Krav |
|---|---|---|
| `accent` | fyllningar: knappar, linjer, chipkant | ≥3:1 mot base/surface, och bär `onAccent` ≥4,5:1 |
| `accentInk` | accentfärgad TEXT på ljus botten: eyebrow, länkar, priser, siffror | ≥4,5:1 mot base/surface/surfaceRaised |
| `accentLight` | accent på det mörka avslutsbandet | ≥4,5:1 mot `deep` |
| `deep` | temats mörka ton: monogram-hero, avslutsband, WhatsApp-knappens yta | ≥4,5:1 mot `base` |

`deep` är tonad per tema i stället för svart, så att det mörka bandet hör
hemma i paletten i stället för att läsa som ett hål i sidan.

### Tema `servicios` (TALLER, ljus stålgrå)

Bas `#F1F2F3` · surface `#E4E6E8` · raised `#FFFFFF` · deep `#161A1E` ·
ink `#15181B` · muted `#4E575F`

| Variant | Låst till | accent | Hue | accentInk | accentLight | Ink/bas | Muted/bas | accentInk/bas | onAccent/accent | accentLight/deep |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `taller` | `#BE7103` | 35° | `#8A5303` | `#EFB55C` | 15,90:1 | 6,57:1 | 5,64:1 | 4,86:1 | 9,52:1 |
| 2 | `servicios` | `#1D4FB8` | 221° | `#1D4FB8` | `#96B6F2` | 15,90:1 | 6,57:1 | 6,54:1 | 6,78:1 | 8,55:1 |

Avstånd mellan varianternas hue: **175°**. Bas/deep 15,60:1.

Temat var mörkdominant i v1 och var då det enda mörka bland fyra — det läste
som ett misstag i familjen, och en mörk sida är dessutom svårare att läsa i
solen, vilket är där kunden står när hen googlar "gomería cerca".

### Tema `gastronomia` (COCINA, krämvit-varm)

Bas `#FBF6EC` · surface `#F3E9D8` · raised `#FFFFFF` · deep `#2A1B11` (v1) /
`#22220F` (v2) · ink `#231A12` · muted `#6B5844`

| Variant | Låst till | accent | Hue | accentInk | accentLight | Ink/bas | Muted/bas | accentInk/bas | onAccent/accent | accentLight/deep |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `gastronomia` | `#B5391B` | 12° | `#93331A` | `#EDA083` | 15,88:1 | 6,28:1 | 7,14:1 | 5,45:1 | 7,88:1 |
| 2 | — (reserv) | `#6B7714` | 67° | `#55600F` | `#C3CE72` | 15,88:1 | 6,28:1 | 6,36:1 | 4,73:1 | 9,51:1 |

Avstånd mellan varianternas hue: **56°**.

**Variant 2 är inte mappad till någon bransch.** `presentationFor` skickar
bara `gastronomia` hit, och den får variant 1. Variant 2 finns kvar för att
`ThemePalettes` är ett par och för att en framtida uppdelning (t.ex.
parrilla/bar mot cocina casera) ska ha någonstans att landa. Den renderas i
QA-gaten men aldrig på en publicerad sajt.

### Tema `comercio` (MERCADO, pappersvit)

Bas `#F6F7F8` · surface `#EAECEF` · raised `#FFFFFF` · deep `#14171B` ·
ink `#15181C` · muted `#525C66`

| Variant | Låst till | accent | Hue | accentInk | accentLight | Ink/bas | Muted/bas | accentInk/bas | onAccent/accent | accentLight/deep |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `comercio` | `#C21744` | 344° | `#A8123C` | `#F291AC` | 16,60:1 | 6,35:1 | 6,95:1 | 5,51:1 | 8,07:1 |
| 2 | `otro` | `#1C6B3A` | 143° | `#186032` | `#79CD9B` | 16,60:1 | 6,35:1 | 7,10:1 | 6,14:1 | 9,43:1 |

Avstånd mellan varianternas hue: **159°**. Bas/deep 16,76:1.

### Tema `salud` (CALMA, blekt blågrön / blekt rosa)

v1: bas `#F2F7F7` · surface `#E3EFEF` · deep `#0A2725` · ink `#10211F` · muted `#4C6462`
v2: bas `#F8F4F7` · surface `#F0E6ED` · deep `#241220` · ink `#221520` · muted `#665264`

| Variant | Låst till | accent | Hue | accentInk | accentLight | Ink/bas | Muted/bas | accentInk/bas | onAccent/accent | accentLight/deep |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `salud` | `#0B6470` | 187° | `#0B6470` | `#7CCCD7` | 15,42:1 | 5,87:1 | 6,32:1 | 6,48:1 | 8,63:1 |
| 2 | `belleza` | `#9A2C86` | 311° | `#872676` | `#E19BD6` | 16,11:1 | 6,52:1 | 7,50:1 | 6,25:1 | 8,34:1 |

Avstånd mellan varianternas hue: **124°**. Det är det enda temat där basen
skiljer sig mellan varianterna: `belleza` bär en svagt rosa neutral,
`salud` en svalt blågrön.

## Avstånd MELLAN teman

40°-regeln gäller inom ett tema. Mellan teman är avstånden ändå mätta, och de
har förbättrats i den här omgången — **minsta avstånd 24°** (v1: 11°):

| Från | Hue | Till | Avstånd |
|---|---|---|---|
| `gastronomia` v1 | 12° | `servicios` v1 (35°) | 24° |
| `servicios` v1 | 35° | `gastronomia` v2 (67°) | 32° |
| `gastronomia` v2 | 67° | `comercio` v2 (143°) | 76° |
| `comercio` v2 | 143° | `salud` v1 (187°) | 44° |
| `salud` v1 | 187° | `servicios` v2 (221°) | 34° |
| `servicios` v2 | 221° | `salud` v2 (311°) | 90° |
| `salud` v2 | 311° | `comercio` v1 (344°) | 33° |
| `comercio` v1 | 344° | `gastronomia` v1 (12°) | 28° |

Det tätaste paret (terracota 12° mot ámbar 35°) är också det par som aldrig
läser lika: den ena ligger på kräm med runda former och grain, den andra på
stålgrått med räta hörn och 45°-raster, och ljusheterna skiljer **12,3 L\***
(terracota `#B5391B` L\* 42,5 mot ámbar `#BE7103` L\* 54,8). Tre av sju
branscher vill ha en varm accent (taller, gastronomía, comercio), så det varma
hörnet är trångt av branschlogik, inte av slarv.

## Sektion → mönster (medveten avvikelse från portföljregeln)

v1 hade en egen sektion→mönster-karta per tema, enligt regeln att två sajter
i registret inte får dela karta. **Den regeln följs inte längre för de fyra
temana, och det är avsiktligt.** Fyra teman som är samma produkt, säljs av
samma person och ligger på samma domän ska läsa som en produktlinje — inte som
fyra sajter som råkar dela CTA. De delar därför exakt samma
sektionsvokabulär, och skiljer sig genom färg, radie, textur, fotobehandling
och i vilken **ordning** blocken ligger:

| Tema | Ordning under hero |
|---|---|
| `servicios` | servicios → [precios] → [catálogo] → trabajos → dónde → cierre |
| `gastronomia` | [carta] → especialidades → el local → dónde → [para llevar] → cierre |
| `comercio` | [catálogo] → rubros → el local → [precios] → dónde → cierre |
| `salud` | tratamientos → **dónde y cuándo** → el lugar → [precios] → [productos] → cierre |

`[…]` = modulberoende (`menu`, `products`, `gallery`). Ordningen är driven av
vad besökaren faktiskt kom för: en restaurangbesökare vill se kartan, en
klinikbesökare vill veta när de har turno, en butiksbesökare vill se pris.

Gemensam grammatik i alla fyra:

| Element | Regel |
|---|---|
| Hero | Bild i fast beskärning (1:1 mobil, 16:6 desktop) + upphöjd **platta** över dess underkant |
| Utan foto | Bilden byts mot ett **monogram** (initialer i display-snittet mot `deep` + temats textur) |
| Plattan | Förekommer exakt två gånger: i hero och över avslutsbandet |
| CTA | WhatsApp-knappen har alltid ytan `deep` — grönt lever bara i glyfen |
| Fast CTA | Fullbredds "pill" i botten, aldrig en overlay eller något som måste stängas |
| Motion | En rörelse: `.reveal` = 14 px lyft + fade, 280 ms, 70 ms stagger |
| Radier | Två skalsteg, temaöverskrivna: servicios 2/4/6 · comercio 6/10/14 · gastronomia 10/18/26 · salud 14/22/32 |

## `.t-light` är borttagen

I v1 bar ljusa teman `.t-light` för att tona ner skuggor och grain som var
satta för mörkdominant design. När varje tema är ljust bär klassen ingen
information — ljusstämda skuggvärden är default i `theme.css`, och det mörka
bandet har egna tokens (`--deep`, `--on-deep`, `--on-deep-muted`). Varje tema
bär i stället sin egen `t-<nyckel>`-klass på roten, `servicios` inkluderat.

## Att fylla i

Övriga domäner i portföljen (byggmedia.se, propia.com.py, educacion.com.py
m.fl.) är inte inventerade här. Det kräver en genomgång av de live-sajterna och
är inte gjort — tills det är gjort går det inte att garantera att sitios
accenter inte krockar med en befintlig sajt.
