import { sql } from "drizzle-orm";
import {
  mysqlTable,
  serial,
  bigint,
  int,
  tinyint,
  varchar,
  text,
  json,
  date,
  datetime,
  boolean,
  mysqlEnum,
  uniqueIndex,
  index,
  char,
} from "drizzle-orm/mysql-core";

const timestamps = {
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => new Date()),
};

/** FK-kolumn som matchar `serial` (bigint unsigned auto_increment). */
const fk = (name: string) => bigint(name, { mode: "number", unsigned: true });

// ---------- users ----------
export const users = mysqlTable(
  "users",
  {
    id: serial("id").primaryKey(),
    role: mysqlEnum("role", ["superadmin", "owner"]).notNull().default("owner"),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 190 }), // superadmin-login
    phone: varchar("phone", { length: 20 }), // +5959XXXXXXXX, owner-login (OTP)
    passwordHash: varchar("password_hash", { length: 100 }), // endast superadmin
    status: mysqlEnum("status", ["active", "disabled"]).notNull().default("active"),
    lastLoginAt: datetime("last_login_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("u_email").on(t.email), uniqueIndex("u_phone").on(t.phone)],
);

// ---------- businesses (tenant-roten) ----------
export const businesses = mysqlTable(
  "businesses",
  {
    id: serial("id").primaryKey(),
    ownerUserId: fk("owner_user_id"), // FK users, null tills owner-konto finns
    slug: varchar("slug", { length: 60 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    category: mysqlEnum("category", [
      "comercio",
      "servicios",
      "gastronomia",
      "salud",
      "belleza",
      "taller",
      "otro",
    ]).notNull(),
    description: text("description"), // putsad brödtext
    rawDescription: text("raw_description"), // kundens originaltext (AI-input, aldrig förlorad)
    servicesJson: json("services_json").$type<{ name: string; desc?: string }[]>(),
    whatsappPhone: varchar("whatsapp_phone", { length: 20 }).notNull(),
    whatsappVerifiedAt: datetime("whatsapp_verified_at"),
    secondaryPhone: varchar("secondary_phone", { length: 20 }),
    address: varchar("address", { length: 200 }),
    zone: varchar("zone", { length: 80 }), // barrio/zona
    city: varchar("city", { length: 80 }).notNull().default("Asunción"),
    lat: varchar("lat", { length: 20 }),
    lng: varchar("lng", { length: 20 }),
    mapsUrl: varchar("maps_url", { length: 300 }),
    socialsJson: json("socials_json").$type<{
      instagram?: string;
      facebook?: string;
      tiktok?: string;
    }>(),
    // "mon".."sun", null = cerrado
    hoursJson: json("hours_json").$type<Record<string, { open: string; close: string }[] | null>>(),
    ruc: varchar("ruc", { length: 20 }), // valfritt, för faktura till kunden
    themeKey: mysqlEnum("theme_key", [
      "comercio",
      "servicios",
      "gastronomia",
      "salud",
      "belleza",
      "taller",
    ]).notNull(),
    paletteVariant: tinyint("palette_variant", { unsigned: true }).notNull().default(1), // 1..4
    logoMediaId: fk("logo_media_id"),
    heroMediaId: fk("hero_media_id"),
    status: mysqlEnum("status", ["draft", "pending_review", "published", "paused", "archived"])
      .notNull()
      .default("draft"),
    publishedAt: datetime("published_at"),
    seoTitle: varchar("seo_title", { length: 70 }),
    seoDescription: varchar("seo_description", { length: 160 }),
    aiPolishedAt: datetime("ai_polished_at"),
    upsellScore: int("upsell_score").notNull().default(0),
    hotLead: boolean("hot_lead").notNull().default(false),
    leadStage: mysqlEnum("lead_stage", ["ninguno", "contactado", "cotizado", "vendido"])
      .notNull()
      .default("ninguno"),
    adminNotes: text("admin_notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("u_slug").on(t.slug),
    index("i_status").on(t.status),
    index("i_category").on(t.category),
    index("i_hotlead").on(t.hotLead),
  ],
);

// ---------- slug_redirects (301 vid slug-byte) ----------
export const slugRedirects = mysqlTable(
  "slug_redirects",
  {
    id: serial("id").primaryKey(),
    oldSlug: varchar("old_slug", { length: 60 }).notNull(),
    businessId: fk("business_id").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("u_old_slug").on(t.oldSlug)],
);

// ---------- media ----------
export const media = mysqlTable(
  "media",
  {
    id: serial("id").primaryKey(),
    businessId: fk("business_id").notNull(),
    kind: mysqlEnum("kind", ["logo", "photo", "menu_item", "product", "receipt"]).notNull(),
    fileKey: varchar("file_key", { length: 120 }).notNull(), // "<bizId>/<hash>" — path ELLER R2-nyckel
    mime: varchar("mime", { length: 40 }).notNull(),
    width: int("width"),
    height: int("height"),
    bytes: int("bytes"),
    variantsJson: json("variants_json").$type<{ w400?: string; w800?: string; w1600?: string }>(),
    altText: varchar("alt_text", { length: 160 }),
    sortOrder: int("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("i_biz_kind").on(t.businessId, t.kind)],
);

// ---------- pages (extra_pages-modulen; home finns implicit) ----------
export const pages = mysqlTable(
  "pages",
  {
    id: serial("id").primaryKey(),
    businessId: fk("business_id").notNull(),
    pageSlug: varchar("page_slug", { length: 60 }).notNull(), // "servicios", "nosotros"…
    type: mysqlEnum("type", [
      "servicios",
      "nosotros",
      "galeria",
      "menu",
      "productos",
      "contacto",
      "custom",
    ]).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    contentJson: json("content_json"), // typade block per sidtyp
    isEnabled: boolean("is_enabled").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("u_biz_pageslug").on(t.businessId, t.pageSlug)],
);

// ---------- moduler ----------
export const businessModules = mysqlTable(
  "business_modules",
  {
    id: serial("id").primaryKey(),
    businessId: fk("business_id").notNull(),
    moduleKey: mysqlEnum("module_key", [
      "gallery",
      "menu",
      "products",
      "extra_pages",
      "booking",
    ]).notNull(),
    isEnabled: boolean("is_enabled").notNull().default(false),
    settingsJson: json("settings_json"),
    enabledAt: datetime("enabled_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("u_biz_module").on(t.businessId, t.moduleKey)],
);

export const menuSections = mysqlTable(
  "menu_sections",
  {
    id: serial("id").primaryKey(),
    businessId: fk("business_id").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    sortOrder: int("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("i_biz").on(t.businessId)],
);

export const menuItems = mysqlTable(
  "menu_items",
  {
    id: serial("id").primaryKey(),
    businessId: fk("business_id").notNull(),
    sectionId: fk("section_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 300 }),
    priceGs: bigint("price_gs", { mode: "number" }), // null = "consultar"
    mediaId: fk("media_id"),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("i_biz_section").on(t.businessId, t.sectionId)],
);

export const products = mysqlTable(
  "products",
  {
    id: serial("id").primaryKey(),
    businessId: fk("business_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 300 }),
    priceGs: bigint("price_gs", { mode: "number" }), // null = "consultar"
    mediaId: fk("media_id"),
    isVisible: boolean("is_visible").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("i_biz").on(t.businessId)],
);

// ---------- verifieringar (WhatsApp-OTP: onboarding + owner-login) ----------
export const verifications = mysqlTable(
  "verifications",
  {
    id: serial("id").primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    businessId: fk("business_id"),
    userId: fk("user_id"),
    purpose: mysqlEnum("purpose", ["onboarding", "login", "phone_change"]).notNull(),
    codeHash: char("code_hash", { length: 64 }).notNull(), // sha256(code + salt)
    channel: mysqlEnum("channel", ["whatsapp_manual", "whatsapp_api"]).notNull(),
    attempts: tinyint("attempts", { unsigned: true }).notNull().default(0),
    expiresAt: datetime("expires_at").notNull(), // +10 min
    verifiedAt: datetime("verified_at"),
    ...timestamps,
  },
  (t) => [index("i_phone_purpose").on(t.phone, t.purpose)],
);

// ---------- prenumerationer & betalningar (manuellt bekräftade) ----------
export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    businessId: fk("business_id").notNull(),
    plan: mysqlEnum("plan", ["basico", "plus", "pro"]).notNull().default("basico"),
    priceGs: bigint("price_gs", { mode: "number" }).notNull(), // årsavgift i heltals-Gs
    startsAt: date("starts_at").notNull(),
    expiresAt: date("expires_at").notNull(),
    status: mysqlEnum("status", ["trial", "active", "grace", "expired", "canceled"])
      .notNull()
      .default("active"),
    ...timestamps,
  },
  (t) => [index("i_biz").on(t.businessId), index("i_expires").on(t.expiresAt)],
);

export const payments = mysqlTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    businessId: fk("business_id").notNull(),
    subscriptionId: fk("subscription_id").notNull(),
    amountGs: bigint("amount_gs", { mode: "number" }).notNull(),
    method: mysqlEnum("method", [
      "transferencia",
      "giros",
      "efectivo",
      "tigo_money",
      "billetera_personal",
      "zimple",
      "tarjeta",
      "otro",
    ]).notNull(),
    reference: varchar("reference", { length: 120 }), // nro de operación
    receiptMediaId: fk("receipt_media_id"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: mysqlEnum("status", ["reported", "confirmed", "rejected"]).notNull().default("reported"),
    confirmedByUserId: fk("confirmed_by_user_id"),
    confirmedAt: datetime("confirmed_at"),
    notes: varchar("notes", { length: 300 }),
    ...timestamps,
  },
  (t) => [index("i_biz").on(t.businessId), index("i_status").on(t.status)],
);

// ---------- analytics ----------
export const analyticsEvents = mysqlTable(
  "analytics_events",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    businessId: fk("business_id").notNull(),
    type: mysqlEnum("type", [
      "page_view",
      "whatsapp_click",
      "phone_click",
      "map_click",
      "social_click",
      "menu_view",
      "gallery_view",
    ]).notNull(),
    path: varchar("path", { length: 120 }),
    referrerHost: varchar("referrer_host", { length: 120 }),
    deviceType: mysqlEnum("device_type", ["mobile", "desktop", "bot", "unknown"])
      .notNull()
      .default("unknown"),
    visitorHash: char("visitor_hash", { length: 32 }), // sha256(ip+ua+dagsalt), trunkerad — ingen PII
    createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("i_biz_created").on(t.businessId, t.createdAt),
    index("i_biz_type_created").on(t.businessId, t.type, t.createdAt),
  ],
);

export const analyticsDaily = mysqlTable(
  "analytics_daily",
  {
    id: serial("id").primaryKey(),
    businessId: fk("business_id").notNull(),
    day: date("day").notNull(),
    views: int("views").notNull().default(0),
    uniques: int("uniques").notNull().default(0),
    waClicks: int("wa_clicks").notNull().default(0),
    phoneClicks: int("phone_clicks").notNull().default(0),
    mapClicks: int("map_clicks").notNull().default(0),
    socialClicks: int("social_clicks").notNull().default(0),
  },
  (t) => [uniqueIndex("u_biz_day").on(t.businessId, t.day)],
);

// ---------- intake-länkar & audit ----------
export const onboardingTokens = mysqlTable(
  "onboarding_tokens",
  {
    id: serial("id").primaryKey(),
    token: char("token", { length: 32 }).notNull(),
    businessId: fk("business_id"), // sätts när utkast skapas
    phone: varchar("phone", { length: 20 }),
    prefillJson: json("prefill_json"), // namn/bransch du redan vet från säljsamtalet
    createdByUserId: fk("created_by_user_id").notNull(),
    expiresAt: datetime("expires_at").notNull(), // +14 dagar
    usedAt: datetime("used_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("u_token").on(t.token)],
);

export const activityLog = mysqlTable(
  "activity_log",
  {
    id: serial("id").primaryKey(),
    actorUserId: fk("actor_user_id"),
    businessId: fk("business_id"),
    action: varchar("action", { length: 80 }).notNull(), // "publish","confirm_payment","lead_contactado"…
    metaJson: json("meta_json"),
    createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("i_biz").on(t.businessId), index("i_action").on(t.action)],
);

// ---------- härledda typer ----------
export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Media = typeof media.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
