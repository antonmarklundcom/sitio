# sitio.com.py — Produkt- och byggplan

> Plan skriven för att kodas efter, PR för PR. Stack är låst: Next.js 15 App Router,
> Drizzle ORM, MySQL (Hostinger), Hostinger managed Node.js, deploy via GitHub-webhook
> (budgeted-runner-policy, se `docs/RUNNER-POLICY.md`: inga filer under
> `.github/workflows/` utan Antons uttryckliga ja — default är noll).
> Kundsajter ligger på `sitio.com.py/[slug]` — folder-baserat, inte subdomäner.
> Domänen är ännu inte registrerad: bygg och deploya på Hostingers temp-domän,
> byt till `sitio.com.py` via `NEXT_PUBLIC_BASE_URL` + A-record (se §3, Deploy).

---

## 1. Produktspec

### 1.1 Vad produkten är

En foot-in-the-door-SaaS för paraguayanska småföretagare: en färdig, snygg,
WhatsApp-first one-page-sajt på `sitio.com.py/[slug]` för 200.000–600.000 Gs/år.
Säljs manuellt via WhatsApp i v1. Produkten är samtidigt en upsell-radar:
analytics per sajt (besök + WhatsApp-klick) identifierar heta kunder för CRM,
Google Business Profile, annonsering och riktig hemsida på egen domän.

### 1.2 Roller

| Roll | Vem | Kan |
|---|---|---|
| `superadmin` | Du | Allt: skapa/redigera/publicera/pausa/ta bort sajter, bekräfta betalningar, se all statistik, hantera moduler |
| `owner` | Företagaren | Redigera texter, byta bilder, ändra öppettider, se sin egen statistik. Kan INTE: byta tema, ändra slug, röra design-tokens, publicera/avpublicera |

### 1.3 Kärnflöden

**A. Onboarding (intake).** Superadmin skapar ett utkast och skickar en unik,
tokenad intake-länk via WhatsApp (`/alta/[token]`). Företagaren (eller du själv,
med kunden i telefon) fyller i: företagsnamn, bransch, beskrivning, tjänster,
öppettider, WhatsApp-nummer, adress/zon/stad, sociala länkar; laddar upp logga +
3–8 foton. WhatsApp-numret verifieras med en 6-siffrig kod skickad via WhatsApp
(se 5.4 — manuellt i MVP, Cloud API i fas 2). Inlämning ⇒ status `pending_review`.

**B. Auto-generering.** Sajten byggs deterministiskt från formulärdata med
**mallteman + datainfyllnad** som grund, och **AI-textputsning som ett valfritt,
engångskört admin-steg** (se 1.4). Ingen AI i runtime — putsad text sparas i DB.

**C. Superadmin-godkännande.** Kö med `pending_review`. Du förhandsgranskar
(`/[slug]?preview=<token>`), justerar vid behov, väljer tema/palettvariant,
kör ev. AI-puts, publicerar. Lista över alla sajter med status, betalstatus,
verifieringsstatus, statistik, hot-lead-flagga.

**D. Owner-admin.** `/mi-sitio` — inloggning via WhatsApp-OTP (rekommenderas;
numret är redan verifierat, inget lösenord att glömma). Formulärfält, inte
fritt HTML: textfält med maxlängder, bildbyte via samma upload-pipeline,
öppettider via strukturerad widget, statistikvy (besök + WhatsApp-klick,
30/365 dagar). Idiotsäkert = de redigerar data, aldrig layout.

**E. Publik sajt.** `/[slug]` renderar valt tema med businessens data. Alltid:
sticky WhatsApp-CTA, öppettider med "Abierto ahora"-logik (America/Asuncion),
karta/adress, sociala länkar, JSON-LD LocalBusiness. Voseo-spanska i all UI.

### 1.4 Genereringsarkitektur: mallteman + valfri AI-puts (beslut)

**Valt:** deterministiska React-teman med datainfyllnad. Skäl: förutsägbart,
noll runtime-kostnad, omöjligt för kunden att förstöra, triviala att QA:a.

**AI-lagret** är ett admin-knapptryck ("Pulir textos") som skickar rådata till
Claude API (Haiku räcker) och skriver tillbaka: putsad `description`, en
`seoDescription` (≤155 tecken), sektionsrubriker och 3–5 tjänstetexter — allt
sparas som vanliga fält, redigerbara efteråt. Kostnad ~noll per sajt, körs en
gång. Detta löser också doorway-/duplicate-content-risken: 200 sajter med
identisk mallprosa och bara namnet utbytt rankar sämre och ser billigt ut.

### 1.5 Teman (6 st, branschanpassade)

Ett tema = en komponentuppsättning + en design-token-fil + 3–4 palettvarianter.
Spänningen mot web-design-system-skillens registerregel (unika accenter ≥40°
isär) är olöslig vid 200+ kunder — lösningen är: **6 teman × 4 palettvarianter
× olika hero-mönster = 24 grundutseenden**, plus att kundens logga/foton bär
det mesta av identiteten. Sajterna länkar aldrig till varandra, så kollisioner
syns bara om två grannar i samma bransch får samma tema+variant — admin väljer
variant manuellt, så det undviks vid publicering.

| Temakey | Bransch | Track (web-design-system) | Karaktär |
|---|---|---|---|
| `comercio` | butik/handel | EDITORIAL | ljus, produktkort, prislista-modul naturlig |
| `servicios` | plomero/electricista/cerrajero m.fl. | INDUSTRIAL | mörk hero, hög kontrast, stor WhatsApp-CTA, zonlista |
| `gastronomia` | restaurang/café | WARM CRAFT | varm, bildtung, meny-modul central |
| `salud` | clínica/dentista/consultorio | CLINICAL | lugn, förtroende, öppettider + turnos framträdande |
| `belleza` | salón/barbería/estética | WARM CRAFT (egen typografi/palettfamilj) | mjuk, galleri central |
| `taller` | mecánica/gomería | INDUSTRIAL (egen palettfamilj) | robust, tjänster + telefon/WhatsApp direkt |

Varje tema följer skillens hårda regler: en accent, WhatsApp-grönt endast i
knappglyfen, grain på mörka sektioner, motion.js-mönstret, scrim på text-över-bild,
mobil-först (nästan all PY-trafik är mobil).

### 1.6 Moduler (upsell inuti produkten)

Bas = one-page. Moduler slås på per kund av superadmin (prissätts av dig utanför
systemet, eller kopplas till plan):

| Modulkey | Innehåll | Kräver |
|---|---|---|
| `gallery` | bildgalleri (upp till 20 foton) | media |
| `menu` | meny med sektioner + rätter + priser (Gs) | gastronomía primärt |
| `products` | produktlista med priser/"consultar" | comercio primärt |
| `extra_pages` | 3–6 undersidor (`/[slug]/servicios`, `/[slug]/nosotros` …) | pages-tabellen |
| `booking` (fas 3+) | turno-förfrågan via WhatsApp-prefill | — |

Datamodellen (2.x) gör varje modul till en rad i `business_modules` + egna
tabeller — att slå på en modul är en flagga, aldrig en migrering.

### 1.7 Betalning i Paraguay (v1: manuell, inte Stripe)

- Pris i heltal Gs (`bigint`), visning `₲ 300.000` (es-PY, inga decimaler).
- Flöde: du säljer via WhatsApp → skapar `subscription` (plan, pris, `startsAt`,
  `expiresAt` = +1 år) → kunden betalar via **transferencia/giros/Tigo Money/
  Billetera Personal/efectivo** → skickar comprobante-foto via WhatsApp → du
  registrerar en `payment` (metod, referens, ev. kvittobild) och markerar
  `confirmed`. Bekräftelse sätter/förlänger `expiresAt`.
- **Förnyelse:** admin-vy "Vencen pronto" (≤45 dagar). Per kund: en
  wa.me-deeplink med förifyllt meddelande som inkluderar årets statistik —
  *"Tu página tuvo 340 visitas y 52 contactos por WhatsApp este año 📈.
  Renovamos por ₲ 300.000?"* Det är säljargumentet, byggt in i produkten.
- Livscykel efter förfall: `active` → (förfallodatum) `grace` (15 dagar, sajten
  uppe) → `expired` ⇒ business `paused` (sajten svarar 404 + `noindex`; datat
  finns kvar). Allt manuellt bekräftat men systemet räknar ut datumen.

### 1.8 Bildhantering (hållbar vid 200+ kunder)

- **Upload:** route handler, max 10 MB/fil, endast jpeg/png/webp/heic, max 8
  foton + logga i bas (20 med gallery-modul).
- **Processering vid upload med `sharp`:** EXIF strippas, auto-rotate, resize
  till varianter **400 / 800 / 1600 px** bredd, konvertera till **webp**
  (kvalitet ~78), logga även som 256px png med bevarad transparens. Original
  slängs efter processering (spar bara största varianten). ~150–400 KB per
  bild totalt ⇒ 200 kunder × ~10 bilder ≈ **2–4 GB — oproblematiskt** på
  Hostinger-disk.
- **Lagring:** en katalog **utanför deploy-trädet** (t.ex.
  `$UPLOADS_DIR=/home/<user>/uploads/sitio`, konfig via env) — Hostingers
  git-deploy skriver om appkatalogen, så uppladdningar får ALDRIG ligga i
  `public/`. Servering via route handler `/media/[businessId]/[file]` med
  `Cache-Control: public, max-age=31536000, immutable` (filnamn innehåller
  hash ⇒ cache-bust vid byte). Verifieras i PR-05 mot faktisk Hostinger-miljö
  innan något annat bygger på det.
- **Skalväg (fas 3, endast vid behov):** flytta till Cloudflare R2 bakom samma
  `media`-tabell (variants-json pekar på URL:er istället för paths). Ingen
  schemaändring krävs — det är därför `variants` är json från dag 1.
- `next/image` används INTE för kundbilder (Hostinger-managed har ingen bra
  image-optimizer-cache-story) — vi servar färdiga varianter med `<img srcset>`.

### 1.9 SEO-arkitektur (folder-baserad, sajterna upplevs fristående)

- **Per sajt:** `generateMetadata` per slug — title
  `"{Namn} – {Bransch} en {Zona}, {Ciudad}"`, unik meta description
  (AI-putsad), `canonical https://sitio.com.py/{slug}`, OG-bild = hero/logga.
- **JSON-LD LocalBusiness** med bransch-subtyp per kategori (`Restaurant`,
  `HealthAndBeautyBusiness`, `AutoRepair`, `MedicalClinic`/`Dentist`, `Store`,
  `HomeAndConstructionBusiness`), `openingHoursSpecification` från hours-json,
  `telephone`, `address` (PostalAddress med `addressLocality`/`addressRegion`),
  `geo` när lat/lng finns, `sameAs` = sociala länkar, `image`, `priceRange`.
- **Ingen korslänkning:** roten `sitio.com.py/` är SaaS:ens egen säljsida och
  listar INTE kunder. Ingen katalog, inga "andra företag i din zon"-widgets,
  ingen synlig "powered by"-länk på kundsajter (öppet beslut D4 — default av).
  Varje sajt har egen title/description/schema och delar inget synligt chrome.
- **Sitemap:** `sitemap.xml` listar alla `published` slugs (+ modulsidor).
  Draft/paused ⇒ 404 + utanför sitemap; pausad som varit publicerad behåller
  raden i `slug_redirects`-logiken (se 2.x) så en återaktivering inte tappar allt.
- **Slug-byten:** `slug_redirects`-tabell ⇒ 301 från gammal slug. Slug sätts
  vid publicering och ändras därefter bara av superadmin.
- **Ärlig mekanik:** folder-sajter ärver sitio.com.py:s domänauktoritet — det
  är en fördel dag 1 (ny .com.py-domän rankar långsamt) och en risk på sikt
  (se §6). Unik text per sajt (AI-puts) + korrekt schema + Google Business
  Profile-länk till sajten är vad som faktiskt driver lokal ranking; GBP är
  dessutom din nästa upsell (gbp-optimizer-skillen).

### 1.10 Analytics (upsell-radarn)

- **Insamling server-side, ingen cookie-banner-problematik:** en liten inline-
  beacon (~400 byte, mönstret från web-design-systems `analytics-prep`) postar
  till `/api/ev`: `page_view` vid load, klick-events via `data-ev`-attribut på
  alla CTAs (`whatsapp_click`, `phone_click`, `map_click`, `social_click`).
- Lagras i `analytics_events` (rå, prunas efter 13 månader) + rullas upp
  nattligt till `analytics_daily` (kräver ingen extern cron — se PR-08:
  self-invoking route med `CRON_SECRET`, triggad av Hostinger cron/hPanel
  eller lazy-rollup vid första admin-läsning per dygn).
- **Botfiltrering:** UA-klassning (bot/mobile/desktop) vid ingest, bots räknas
  aldrig in i visningssiffror. `visitorHash = sha256(ip + ua + dagsalt)` för
  unika/dag utan PII-lagring.
- **Upsell-score:** nattligt jobb sätter `businesses.upsellScore` =
  viktad 30-dagars `waClicks*5 + views`. Admin-vy "Hot leads" sorterad på
  score, med tröskelflagga (`hotLead` när waClicks30d ≥ 15 eller views30d ≥ 300
  — trösklar i env, justeras med verklig data). Därifrån: wa.me-deeplink +
  anteckningsfält + status (`contactado/cotizado/vendido`) i `activity_log`.
  (Fas 3-option: pusha hot leads till VenderCRM via `vendercrm-lead-capture`.)

### 1.11 Routing & reserverade slugs

- `app/[slug]/page.tsx` (+ `app/[slug]/[page]/page.tsx` för extra_pages-modulen).
- Reserverad slug-lista i kod: `admin, mi-sitio, alta, api, media, login,
  logout, precios, contacto, terminos, privacidad, sitemap.xml, robots.txt` m.fl.
  Valideras vid slug-sättning OCH i middleware.
- Publicerade sajter renderas med **ISR** (`revalidateTag('biz:'+slug)` vid
  varje write) — Hostinger-noden serverar då statiskt-cachat, vilket är hela
  skalbarhetsstoryn för en enda Node-process.

---

## 2. Datamodell (Drizzle, komplett från dag 1)

Principer: allt tenant-skopat har `businessId` (indexerat), pengar i `bigint`
heltals-Gs, alla statusar som enum-kolumner, `createdAt/updatedAt` överallt,
inga tabeller som kräver ommigrering när fas 2/3 slås på — moduler, betalningar,
analytics och multi-page finns i schemat från PR-02 även om UI kommer senare.

```ts
// src/db/schema.ts (mysql-core) — auktoritativ version, Opus kodar exakt detta
import {
  mysqlTable, serial, bigint, int, tinyint, varchar, text, json, date,
  datetime, boolean, mysqlEnum, uniqueIndex, index, char,
} from "drizzle-orm/mysql-core";

const timestamps = {
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => new Date()),
};

// ---------- users ----------
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  role: mysqlEnum("role", ["superadmin", "owner"]).notNull().default("owner"),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 190 }),            // superadmin-login
  phone: varchar("phone", { length: 20 }),             // +5959XXXXXXXX, owner-login (OTP)
  passwordHash: varchar("password_hash", { length: 100 }), // endast superadmin
  status: mysqlEnum("status", ["active", "disabled"]).notNull().default("active"),
  lastLoginAt: datetime("last_login_at"),
  ...timestamps,
}, (t) => [uniqueIndex("u_email").on(t.email), uniqueIndex("u_phone").on(t.phone)]);

// ---------- businesses (tenant-roten) ----------
export const businesses = mysqlTable("businesses", {
  id: serial("id").primaryKey(),
  ownerUserId: bigint("owner_user_id", { mode: "number", unsigned: true }), // FK users, null tills owner-konto finns
  slug: varchar("slug", { length: 60 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  category: mysqlEnum("category",
    ["comercio","servicios","gastronomia","salud","belleza","taller","otro"]).notNull(),
  description: text("description"),                    // putsad brödtext
  rawDescription: text("raw_description"),             // kundens originaltext (AI-input, aldrig förlorad)
  servicesJson: json("services_json").$type<{ name: string; desc?: string }[]>(),
  whatsappPhone: varchar("whatsapp_phone", { length: 20 }).notNull(),
  whatsappVerifiedAt: datetime("whatsapp_verified_at"),
  secondaryPhone: varchar("secondary_phone", { length: 20 }),
  address: varchar("address", { length: 200 }),
  zone: varchar("zone", { length: 80 }),               // barrio/zona
  city: varchar("city", { length: 80 }).notNull().default("Asunción"),
  lat: varchar("lat", { length: 20 }),
  lng: varchar("lng", { length: 20 }),
  mapsUrl: varchar("maps_url", { length: 300 }),
  socialsJson: json("socials_json").$type<{ instagram?: string; facebook?: string; tiktok?: string }>(),
  hoursJson: json("hours_json").$type<Record<string, { open: string; close: string }[] | null>>(), // "mon".."sun", null = cerrado
  ruc: varchar("ruc", { length: 20 }),                 // valfritt, för faktura till kunden
  themeKey: mysqlEnum("theme_key",
    ["comercio","servicios","gastronomia","salud","belleza","taller"]).notNull(),
  paletteVariant: tinyint("palette_variant", { unsigned: true }).notNull().default(1), // 1..4
  logoMediaId: bigint("logo_media_id", { mode: "number", unsigned: true }),
  heroMediaId: bigint("hero_media_id", { mode: "number", unsigned: true }),
  status: mysqlEnum("status",
    ["draft","pending_review","published","paused","archived"]).notNull().default("draft"),
  publishedAt: datetime("published_at"),
  seoTitle: varchar("seo_title", { length: 70 }),
  seoDescription: varchar("seo_description", { length: 160 }),
  aiPolishedAt: datetime("ai_polished_at"),
  upsellScore: int("upsell_score").notNull().default(0),
  hotLead: boolean("hot_lead").notNull().default(false),
  leadStage: mysqlEnum("lead_stage",
    ["ninguno","contactado","cotizado","vendido"]).notNull().default("ninguno"),
  adminNotes: text("admin_notes"),
  ...timestamps,
}, (t) => [
  uniqueIndex("u_slug").on(t.slug),
  index("i_status").on(t.status),
  index("i_category").on(t.category),
  index("i_hotlead").on(t.hotLead),
]);

// ---------- slug_redirects (301 vid slug-byte) ----------
export const slugRedirects = mysqlTable("slug_redirects", {
  id: serial("id").primaryKey(),
  oldSlug: varchar("old_slug", { length: 60 }).notNull(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("u_old_slug").on(t.oldSlug)]);

// ---------- media ----------
export const media = mysqlTable("media", {
  id: serial("id").primaryKey(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  kind: mysqlEnum("kind", ["logo","photo","menu_item","product","receipt"]).notNull(),
  fileKey: varchar("file_key", { length: 120 }).notNull(), // "<bizId>/<hash>" — path ELLER R2-nyckel
  mime: varchar("mime", { length: 40 }).notNull(),
  width: int("width"),
  height: int("height"),
  bytes: int("bytes"),
  variantsJson: json("variants_json").$type<{ w400?: string; w800?: string; w1600?: string }>(),
  altText: varchar("alt_text", { length: 160 }),
  sortOrder: int("sort_order").notNull().default(0),
  ...timestamps,
}, (t) => [index("i_biz_kind").on(t.businessId, t.kind)]);

// ---------- pages (extra_pages-modulen; home finns implicit) ----------
export const pages = mysqlTable("pages", {
  id: serial("id").primaryKey(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  pageSlug: varchar("page_slug", { length: 60 }).notNull(), // "servicios", "nosotros"…
  type: mysqlEnum("type",
    ["servicios","nosotros","galeria","menu","productos","contacto","custom"]).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  contentJson: json("content_json"),                    // typade block per sidtyp
  isEnabled: boolean("is_enabled").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  ...timestamps,
}, (t) => [uniqueIndex("u_biz_pageslug").on(t.businessId, t.pageSlug)]);

// ---------- moduler ----------
export const businessModules = mysqlTable("business_modules", {
  id: serial("id").primaryKey(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  moduleKey: mysqlEnum("module_key",
    ["gallery","menu","products","extra_pages","booking"]).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  settingsJson: json("settings_json"),
  enabledAt: datetime("enabled_at"),
  ...timestamps,
}, (t) => [uniqueIndex("u_biz_module").on(t.businessId, t.moduleKey)]);

export const menuSections = mysqlTable("menu_sections", {
  id: serial("id").primaryKey(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  ...timestamps,
}, (t) => [index("i_biz").on(t.businessId)]);

export const menuItems = mysqlTable("menu_items", {
  id: serial("id").primaryKey(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  sectionId: bigint("section_id", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 300 }),
  priceGs: bigint("price_gs", { mode: "number" }),      // null = "consultar"
  mediaId: bigint("media_id", { mode: "number", unsigned: true }),
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  ...timestamps,
}, (t) => [index("i_biz_section").on(t.businessId, t.sectionId)]);

export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 300 }),
  priceGs: bigint("price_gs", { mode: "number" }),      // null = "consultar"
  mediaId: bigint("media_id", { mode: "number", unsigned: true }),
  isVisible: boolean("is_visible").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  ...timestamps,
}, (t) => [index("i_biz").on(t.businessId)]);

// ---------- verifieringar (WhatsApp-OTP: onboarding + owner-login) ----------
export const verifications = mysqlTable("verifications", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }),
  userId: bigint("user_id", { mode: "number", unsigned: true }),
  purpose: mysqlEnum("purpose", ["onboarding","login","phone_change"]).notNull(),
  codeHash: char("code_hash", { length: 64 }).notNull(),  // sha256(code + salt)
  channel: mysqlEnum("channel", ["whatsapp_manual","whatsapp_api"]).notNull(),
  attempts: tinyint("attempts", { unsigned: true }).notNull().default(0),
  expiresAt: datetime("expires_at").notNull(),             // +10 min
  verifiedAt: datetime("verified_at"),
  ...timestamps,
}, (t) => [index("i_phone_purpose").on(t.phone, t.purpose)]);

// ---------- prenumerationer & betalningar (manuellt bekräftade) ----------
export const subscriptions = mysqlTable("subscriptions", {
  id: serial("id").primaryKey(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  plan: mysqlEnum("plan", ["basico","plus","pro"]).notNull().default("basico"),
  priceGs: bigint("price_gs", { mode: "number" }).notNull(), // årsavgift i heltals-Gs
  startsAt: date("starts_at").notNull(),
  expiresAt: date("expires_at").notNull(),
  status: mysqlEnum("status",
    ["trial","active","grace","expired","canceled"]).notNull().default("active"),
  ...timestamps,
}, (t) => [index("i_biz").on(t.businessId), index("i_expires").on(t.expiresAt)]);

export const payments = mysqlTable("payments", {
  id: serial("id").primaryKey(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  subscriptionId: bigint("subscription_id", { mode: "number", unsigned: true }).notNull(),
  amountGs: bigint("amount_gs", { mode: "number" }).notNull(),
  method: mysqlEnum("method",
    ["transferencia","giros","efectivo","tigo_money","billetera_personal","zimple","tarjeta","otro"]).notNull(),
  reference: varchar("reference", { length: 120 }),     // nro de operación
  receiptMediaId: bigint("receipt_media_id", { mode: "number", unsigned: true }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  status: mysqlEnum("status", ["reported","confirmed","rejected"]).notNull().default("reported"),
  confirmedByUserId: bigint("confirmed_by_user_id", { mode: "number", unsigned: true }),
  confirmedAt: datetime("confirmed_at"),
  notes: varchar("notes", { length: 300 }),
  ...timestamps,
}, (t) => [index("i_biz").on(t.businessId), index("i_status").on(t.status)]);

// ---------- analytics ----------
export const analyticsEvents = mysqlTable("analytics_events", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  type: mysqlEnum("type",
    ["page_view","whatsapp_click","phone_click","map_click","social_click","menu_view","gallery_view"]).notNull(),
  path: varchar("path", { length: 120 }),
  referrerHost: varchar("referrer_host", { length: 120 }),
  deviceType: mysqlEnum("device_type", ["mobile","desktop","bot","unknown"]).notNull().default("unknown"),
  visitorHash: char("visitor_hash", { length: 32 }),    // sha256(ip+ua+dagsalt), trunkerad — ingen PII
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index("i_biz_created").on(t.businessId, t.createdAt),
  index("i_biz_type_created").on(t.businessId, t.type, t.createdAt),
]);

export const analyticsDaily = mysqlTable("analytics_daily", {
  id: serial("id").primaryKey(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }).notNull(),
  day: date("day").notNull(),
  views: int("views").notNull().default(0),
  uniques: int("uniques").notNull().default(0),
  waClicks: int("wa_clicks").notNull().default(0),
  phoneClicks: int("phone_clicks").notNull().default(0),
  mapClicks: int("map_clicks").notNull().default(0),
  socialClicks: int("social_clicks").notNull().default(0),
}, (t) => [uniqueIndex("u_biz_day").on(t.businessId, t.day)]);

// ---------- intake-länkar & audit ----------
export const onboardingTokens = mysqlTable("onboarding_tokens", {
  id: serial("id").primaryKey(),
  token: char("token", { length: 32 }).notNull(),
  businessId: bigint("business_id", { mode: "number", unsigned: true }), // sätts när utkast skapas
  phone: varchar("phone", { length: 20 }),
  prefillJson: json("prefill_json"),                    // namn/bransch du redan vet från säljsamtalet
  createdByUserId: bigint("created_by_user_id", { mode: "number", unsigned: true }).notNull(),
  expiresAt: datetime("expires_at").notNull(),          // +14 dagar
  usedAt: datetime("used_at"),
  ...timestamps,
}, (t) => [uniqueIndex("u_token").on(t.token)]);

export const activityLog = mysqlTable("activity_log", {
  id: serial("id").primaryKey(),
  actorUserId: bigint("actor_user_id", { mode: "number", unsigned: true }),
  businessId: bigint("business_id", { mode: "number", unsigned: true }),
  action: varchar("action", { length: 80 }).notNull(),  // "publish","confirm_payment","lead_contactado"…
  metaJson: json("meta_json"),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("i_biz").on(t.businessId), index("i_action").on(t.action)]);
```

**Varför inget kräver ommigrering senare:**
- Moduler = flaggor i `business_modules`; modultabellerna finns tomma från start.
- Multi-page = `pages`-tabellen finns från start; MVP renderar bara "home" (implicit).
- Betalstatus + prenumerationslivscykel i schemat dag 1 ⇒ förnyelsevyn är en query, inte en ombyggnad.
- `media.fileKey` + `variantsJson` är lagringsagnostiska ⇒ R2-flytt utan schemaändring.
- `verifications.channel` rymmer både manuell MVP-kod och Cloud API.
- `users.phone` + roll `owner` finns dag 1 fast owner-login byggs i fas 2.
- `upsellScore/hotLead/leadStage` dag 1 ⇒ radarvyn är UI ovanpå befintliga kolumner.

---

## 3. Fasindelad byggplan (PR-storlekar för Opus)

Regler för alla PR: en PR = ett körbart, testbart inkrement. `npm run build`
grönt lokalt före push (husky pre-push per budgeted-runner-skillen; pre-commit
blockerar `.github/workflows/`). Inga GitHub Actions utan uttryckligt godkännande
— se `docs/RUNNER-POLICY.md`. Spanska (voseo) i all
kund-/owner-UI, svenska/engelska kvittar i superadmin. Alla mutationer
server-side-skyddade med `requireRole` + tenant-filter.

### Fas 1 — MVP (du säljer manuellt via WhatsApp; mål: första betalande kund live)

| PR | Innehåll | Storlek |
|---|---|---|
| **PR-01 Scaffold** | create-next-app (TS, Tailwind), drizzle-orm/mysql2/drizzle-kit/tsx, `drizzle.config.ts`, `src/db/index.ts` (pool, connectionLimit 8, timezone Z), `.env.example` (inkl. `NEXT_PUBLIC_BASE_URL`), husky pre-commit (workflow-blockare) + pre-push (typecheck+build), README med deploysteg. **Regel från dag 1: noll hårdkodade absolut-URL:er — allt via `NEXT_PUBLIC_BASE_URL`, så domänbytet blir en env-ändring** | S (~15 filer) |
| **PR-02 Schema + seed** | Hela schemat från §2 exakt, första migrering, `scripts/seed-dev.ts` (superadmin + 3 demo-businesses med realistisk PY-data, giltiga telefonformat, Gs-priser) | M (~6 filer, schema är stort men mekaniskt) |
| **PR-03 Auth (superadmin)** | iron-session + bcrypt, `/admin/login`, `requireRole`-helper, middleware-skydd av `/admin/*`, activity_log på login | S–M |
| **PR-04 Superadmin: businesses CRUD** | `/admin`-layout, lista (status, betalstatus-badge, verifieringsbadge, sök/filter), skapa/redigera-formulär (alla fält inkl. hours-widget, socials), statusövergångar draft→pending→published→paused med slug-validering mot reservlistan, slug_redirects vid byte, preview-token | **L — dela i 4a (lista+skapa/redigera) och 4b (statusflöde+preview)** |
| **PR-05 Media-pipeline** | Upload route (auth, validering, storleksgräns), sharp-varianter 400/800/1600 webp + logo-png, lagring i `UPLOADS_DIR` utanför repo, serverings-route med immutable cache, sortering/radering i admin, kopplat till business. **Inkluderar deploy-test mot Hostinger: överlever uploads en redeploy? Dokumentera svaret i README** | M |
| **PR-06 Publik rendering + tema 1 + SEO** | `app/[slug]/page.tsx` med ISR + revalidateTag, tema `servicios` komplett enligt web-design-system (tokens, mönsterkarta, motion.js, grain, WhatsApp-CTA med `data-ev`), generateMetadata, JSON-LD LocalBusiness, 404 för icke-published, 301 via slug_redirects, sitemap.xml + robots.txt, reserved-slug-middleware | **L — dela i 6a (rendering+SEO-infra) och 6b (temat visuellt färdigt + QA-gate)** |
| **PR-07 Teman 2–3** | `gastronomia` + `comercio`, palettvarianter ×4 per tema, tema-registry (`themeKey → komponent`), admin-väljare tema+variant med förhandsvisning | M–L (dela per tema om >600 rader) |
| **PR-08 Analytics ingest + adminstatistik** | `/api/ev`-endpoint (botklassning, visitorHash, rate-limit per IP), beacon i temalayouten, rollup-script till analytics_daily (route med CRON_SECRET + hPanel-cron, med lazy-fallback), admin: per-sajt-graf 30/365 dgr (views, uniques, wa-klick) + kolumner i sajtlistan | M |
| **PR-09 Subscriptions + payments-admin** | Skapa/förläng prenumeration, registrera betalning (metod, referens, kvittobild via media), bekräfta/avvisa, "Vencen pronto"-vy (≤45 dgr) med wa.me-förnyelselänk som inkluderar årsstatistik, statusmaskineri active→grace→expired→paused (dagligt cron-steg i samma rollup-route) | M–L |
| **PR-10 Intake + WhatsApp-verifiering (manuell)** | onboarding_tokens-admin ("skapa intake-länk", wa.me-delning), `/alta/[token]`-formulär (mobilanpassat, stegvis: uppgifter→foton→verifiering), OTP: koden genereras + visas för DIG i admin, du skickar den via din egen WhatsApp, kunden matar in → `whatsappVerifiedAt`. Inlämning ⇒ pending_review + notis i admin | M–L |

**MVP är klart när:** du kan sälja i ett WhatsApp-samtal, skicka intake-länk,
godkänna, publicera på `sitio.com.py/kunden`, registrera betalningen, och se
besök + WhatsApp-klick dagen efter. (Deploy sker efter PR-06 första gången —
tidigare PR verifieras lokalt.)

### Fas 2 — Owner-admin, moduler, radar

| PR | Innehåll | Storlek |
|---|---|---|
| **PR-11 Owner-auth + mi-sitio** | WhatsApp-OTP-login (samma verifications-flöde; koden manuell tills PR-17), owner-konto skapas vid publicering, `/mi-sitio`: redigera texter/tjänster/öppettider/socials (whitelisted fält, maxlängder), byta bilder, statistikvy. Tenant-check på varje mutation | L — dela i 11a (auth) och 11b (redigering+stats) |
| **PR-12 Modul-infra + gallery** | business_modules-admin (slå på/av per kund), tema-sektioner renderar villkorat, gallery-modulen (owner kan sortera/byta upp till 20 foton) | M |
| **PR-13 Menu-modul** | Sektioner + rätter + Gs-priser, owner-CRUD (idiotsäker: bara text/pris/bild/tillgänglig), rendering i gastronomia-temat + generisk fallback, `menu_view`-event | M |
| **PR-14 Products-modul** | Samma mönster som PR-13 för comercio | S–M (kopierar mönstret) |
| **PR-15 Teman 4–6** | `salud`, `belleza`, `taller` + palettvarianter, QA-gate per tema | M–L (dela per tema) |
| **PR-16 Upsell-radar** | Nattlig score-beräkning, hot-lead-flaggning (trösklar i env), `/admin/leads`-vy med sortering, leadStage-knappar, anteckningar, wa.me-pitch-länk med förifylld statistik | M |
| **PR-17 WhatsApp Cloud API** | Meta Business-verifiering förutsätts klar (din uppgift, ej kod). Template-baserad OTP-sändning, channel `whatsapp_api`, fallback till manuell, sändlogg i activity_log | M |

### Fas 3 — Skala & självbetjäning

| PR | Innehåll | Storlek |
|---|---|---|
| **PR-18 Extra pages-modul** | `app/[slug]/[page]`, pages-CRUD i admin (owner får redigera innehåll, inte skapa/ta bort sidor), navigering i teman, sitemap-utökning | M–L |
| **PR-19 Self-service signup** | Öppet `/alta` utan token, WhatsApp-OTP obligatorisk, kunden rapporterar betalning själv (metod + referens + kvittofoto ⇒ payment `reported`), du bekräftar. Fortfarande godkännandekö före publicering | L — dela i 19a (signup) och 19b (betalningsrapportering) |
| **PR-20 Renewal-automation** | Automatiska förnyelsepåminnelser via Cloud API-templates (45/15/3 dgr), årsrapport-sida per kund ("tu año en cifras") som säljverktyg | M |
| **PR-21 (vid behov) R2-migrering** | Flytta media till Cloudflare R2, `fileKey` pekar på R2, migreringsscript | M |
| **PR-22 (option) VenderCRM-koppling** | Hot leads pushas som deals via vendercrm-lead-capture-mönstret | S |

### Deploy — tvåstegs, temp-domän först

**Steg A — temp-domän (första deploy, efter PR-06).** Per nextjs-deploy-hostinger
+ budgeted-runner-skillen: hPanel → Node.js App → Import Git Repository → `main`.
Appen körs på Hostingers `*.hostingersite.com`-adress. Env: `DATABASE_URL`
(localhost-varianten), `SESSION_SECRET`, `CRON_SECRET`, `UPLOADS_DIR`,
`NEXT_PUBLIC_BASE_URL` (= temp-adressen till att börja med), `ANTHROPIC_API_KEY`
(AI-puts), trösklar. DB-init körs lokalt via Remote MySQL (kom ihåg: tsx laddar
inte .env själv; drizzle-kit gör det). Slot bokförs i kontokartan.

Temp-domänen är för **din** validering — PR-05:s uploads-test, PR-06:s
rendering och QA-gate, hela MVP-flödet end-to-end. Ingen kund får någonsin en
temp-URL.

**Steg B — riktig domän (före första betalande kund).** `sitio.com.py`
registreras via NIC.py (~25 USD). Köp den **nu**, oberoende av byggtakten:
namnet är generiskt och attraktivt, och NIC.py-registreringen ska inte ligga i
kritiska vägen när första kunden ska gå live.

Bytet är billigt just för att sajterna ligger på **sökväg** (`/[slug]`), inte
subdomäner. Checklista:

1. A-record `sitio.com.py` + `www` → Hostinger-slottens IP
2. Peka Node.js-appens domän till `sitio.com.py` i hPanel, SSL utfärdat
3. `NEXT_PUBLIC_BASE_URL` = `https://sitio.com.py`, appen omstartad
4. Verifiera att allt som bakat in absolut-URL följer med: `generateMetadata`
   (canonical, og:url), JSON-LD `LocalBusiness.url`, `sitemap.xml`, `robots.txt`,
   preview-token-länkar, wa.me-pitchlänkar i admin
5. 301 från temp-adressen om den hunnit indexeras

**Kod-krav som följer av detta:** ingen absolut URL får hårdkodas någonstans —
allt går via `NEXT_PUBLIC_BASE_URL`. Gäller från PR-01. Domänbytet ska vara en
env-ändring, aldrig en refaktorering.

---

## 4. Öppna beslut du måste ta själv

| # | Beslut | Min rekommendation |
|---|---|---|
| D1 | **Owner-login: WhatsApp-OTP eller lösenord?** OTP är friktionsfritt och numret är redan verifierat, men kräver att du skickar koder manuellt tills Cloud API (PR-17) finns. | OTP; i fas 2 innan PR-17 innebär det att owner-logins går genom dig — acceptabelt vid <30 kunder |
| D2 | **Prisplaner:** vad ingår i 200k vs 600k? Moduler per styck eller paketerade i basico/plus/pro? Schemat stödjer båda. | Tre paket: basico (one-page) / plus (en modul + galleri) / pro (allt + extra pages). Enklare att sälja än à la carte |
| D3 | **Grace-period efter förfall:** 15 dagar föreslaget. Kortare = kassaflöde, längre = mindre churn-friktion. | 15 dagar + påminnelse dag 45/15/3 före förfall |
| D4 | **"Hecho con sitio.com.py"-länk i footern?** Gratis marknadsföring och interna länkar, men bryter "fristående"-känslan och avslöjar mall. | Av som default; ev. på som rabattmorot ("₲50.000 billigare med länk") |
| D5 | **Ska roten sitio.com.py någonsin lista kunder (katalog)?** Katalog hjälper din SEO men gör kundsajterna till "profiler i en katalog". | Nej — roten är endast säljsida för SaaS:en |
| D6 | **WhatsApp Cloud API-leverantör och timing:** direkt mot Meta eller via BSP (360dialog/Twilio)? Kräver Meta Business-verifiering + godkända templates + kostnad per konversation. | Manuellt tills ~25 kunder, sedan 360dialog (billigast per meddelande, minst lock-in) |
| D7 | **AI-puts: alltid, eller opt-in per sajt?** Alltid ger unikt innehåll överallt (SEO-skydd) men du förlorar kundens röst. | Alltid köra, men du granskar diffen före publicering (den vyn ingår i AI-puts-steget) |
| D8 | **Trial/demo-läge:** bygga sajten gratis och visa preview-länk innan betalning (starkt säljverktyg), eller betala först? Schemat stödjer trial-status. | Bygg-först-visa-sen: preview-token kostar dig inget och stänger affärer |
| D9 | **Hostinger-konto/slot:** vilket av de tre kontona (LATAM rimligast) och bekräfta att en slot är ledig. | — (bara du vet slot-läget) |
| D10 | **Priser på moduler i efterhand** (kund köper meny-modul år 2): pro-rata eller helår? | Helår vid aktivering, förenklar bokföringen |

---

## 5. Risker och svaga punkter (kritiskt, inte säljande)

1. **Alla ägg i en domän.** En manuell åtgärd/algoritmisk nedvärdering av
   sitio.com.py drabbar ALLA kunder samtidigt. 200 strukturellt likartade
   undersidor med tunt innehåll är precis det mönster Google klassar som
   doorway pages. Motmedel (AI-unik text, riktiga foton, korrekt schema,
   GBP-länkar in) minskar risken men tar inte bort den. Detta är planens
   största enskilda risk och den är arkitektonisk — du har valt bort
   subdomäner/egna domäner medvetet; var ärlig mot dig själv om att "riktig
   hemsida på egen domän" -upsellen delvis är en försäkring mot din egen risk.
2. **Kunden äger inget.** Slugsajten kan inte flyttas, och rankingen tillhör
   din domän. Det är churn-skydd men också ett säljinvändningsvapen för
   konkurrenter ("du hyr, du äger inte"). Ha ett ärligt svar redo.
3. **Hostinger-taket.** En Node-process, delad MySQL med connection-cap, ingen
   CDN, uploads på lokal disk vars persistens över redeploys **måste
   verifieras i PR-05 innan mer byggs** — om Hostingers git-deploy nollställer
   appkatalogen och `UPLOADS_DIR` inte kan ligga utanför den, tvingas
   R2-flytten (PR-21) in i fas 1. ISR gör läs-trafiken billig, men 200 sajter
   × trafiktoppar + analytics-writes på samma process är otestat. Mätpunkt:
   när p95-svarstid eller MySQL-anslutningar börjar spika är VPS-flytt
   (samma stack, mer resurser) nästa steg — inte en omskrivning.
4. **WhatsApp-verifieringen är manuell längre än du tror.** Meta-verifiering,
   template-godkännande och BSP-avtal tar veckor och kostar löpande. Fram till
   PR-17 skickar du varje OTP själv — det skalar till kanske 30 kunder, sedan
   är det ett dagligt irritationsmoment. Budgetera tiden för Meta-processen
   nu, inte när det gör ont.
5. **Manuell betalningshantering är en dold heltidstjänst i vardande.** Vid 200
   kunder är årsförnyelse ~4 samtal/vecka jämnt utspritt — men de kommer inte
   jämnt utspritt (försäljning klumpar sig). "Vencen pronto"-vyn och
   pitch-länkarna är byggda för detta, men systemet kan inte ta emot pengar;
   varje krona kräver din hand. Räkna med att D6/PR-20 (automatiska
   påminnelser) blir nödvändiga tidigare än planerat.
6. **Design-sameness vid skala.** 6 teman × 4 varianter räcker till ~50 kunder
   innan två frisörer i samma barrio har samma sajt i olika färg. Det
   undergräver både priset och "riktig hemsida"-upsellen. Motmedel: foton och
   logga bär identiteten (kräv bra foton vid onboarding — dålig bildkvalitet
   är produktens verkliga akilleshäl), och nya palettvarianter är billiga att
   addera. Men mall är mall; översälj inte "unik design".
7. **Analytics-siffrorna kan ljuga åt båda håll.** Utan botfilter blåses
   siffrorna upp (och ditt förnyelseargument blir ohederligt); med aggressiv
   filtrering tappar du legitima klick (WhatsApp-appens in-app-browser,
   privacy-lägen). Rulla ut mätningen tidigt (PR-08) så du har ett år av
   kalibrerade siffror inför första förnyelsevågen — det är därför den ligger
   i fas 1 trots att ingen kund frågar efter den.
8. **Godkännandekön är du.** Varje sajt passerar dina ögon före publicering —
   bra för kvalitet, men det gör din tillgänglighet till produktens
   flaskhals. Fas 3:s self-service ändrar inte det (kön finns kvar). Om
   volymen kommer, behöver du antingen släppa kravet eller anställa granskning.
9. **Innehållsansvar.** Du publicerar andras påståenden ("bästa priserna",
   hälsopåståenden från clínicas) på din domän. Ha användarvillkor + rätt att
   pausa i avtalet från kund #1, och ta bort-flödet finns redan (paused/archived).
10. **Priset är lågt och supporten är inte noll.** 200.000 Gs/år ≈ en
    timmes konsultarvode. Varje "kan du ändra mina öppettider"-WhatsApp äter
    marginalen. Owner-admin (PR-11) är därför inte en lyxfunktion utan
    lönsamhetens förutsättning — prioritera den direkt efter MVP.

---

*Referens-skills för implementationen: `nodejs-mysql-hostinger-stack` (scaffold,
auth-mönster, roller), `nextjs-deploy-hostinger` (deploy, Remote MySQL, env-fällor),
`web-design-system` (tokens, mönster, QA-gate — läses per tema-PR),
`paraguay-business-apps` (Gs, RUC, WhatsApp-normalisering, voseo),
`budgeted-runner-deploy` (workflow-policy, husky-guards, minutbudget).*
