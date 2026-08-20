CREATE TABLE `activity_log` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`actor_user_id` bigint unsigned,
	`business_id` bigint unsigned,
	`action` varchar(80) NOT NULL,
	`meta_json` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_daily` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`uniques` int NOT NULL DEFAULT 0,
	`wa_clicks` int NOT NULL DEFAULT 0,
	`phone_clicks` int NOT NULL DEFAULT 0,
	`map_clicks` int NOT NULL DEFAULT 0,
	`social_clicks` int NOT NULL DEFAULT 0,
	CONSTRAINT `analytics_daily_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_biz_day` UNIQUE(`business_id`,`day`)
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`type` enum('page_view','whatsapp_click','phone_click','map_click','social_click','menu_view','gallery_view') NOT NULL,
	`path` varchar(120),
	`referrer_host` varchar(120),
	`device_type` enum('mobile','desktop','bot','unknown') NOT NULL DEFAULT 'unknown',
	`visitor_hash` char(32),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_modules` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`module_key` enum('gallery','menu','products','extra_pages','booking') NOT NULL,
	`is_enabled` boolean NOT NULL DEFAULT false,
	`settings_json` json,
	`enabled_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `business_modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_biz_module` UNIQUE(`business_id`,`module_key`)
);
--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_user_id` bigint unsigned,
	`slug` varchar(60) NOT NULL,
	`name` varchar(120) NOT NULL,
	`category` enum('comercio','servicios','gastronomia','salud','belleza','taller','otro') NOT NULL,
	`description` text,
	`raw_description` text,
	`services_json` json,
	`whatsapp_phone` varchar(20) NOT NULL,
	`whatsapp_verified_at` datetime,
	`secondary_phone` varchar(20),
	`address` varchar(200),
	`zone` varchar(80),
	`city` varchar(80) NOT NULL DEFAULT 'Asunción',
	`lat` varchar(20),
	`lng` varchar(20),
	`maps_url` varchar(300),
	`socials_json` json,
	`hours_json` json,
	`ruc` varchar(20),
	`theme_key` enum('comercio','servicios','gastronomia','salud','belleza','taller') NOT NULL,
	`palette_variant` tinyint unsigned NOT NULL DEFAULT 1,
	`logo_media_id` bigint unsigned,
	`hero_media_id` bigint unsigned,
	`status` enum('draft','pending_review','published','paused','archived') NOT NULL DEFAULT 'draft',
	`published_at` datetime,
	`seo_title` varchar(70),
	`seo_description` varchar(160),
	`ai_polished_at` datetime,
	`upsell_score` int NOT NULL DEFAULT 0,
	`hot_lead` boolean NOT NULL DEFAULT false,
	`lead_stage` enum('ninguno','contactado','cotizado','vendido') NOT NULL DEFAULT 'ninguno',
	`admin_notes` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `businesses_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`kind` enum('logo','photo','menu_item','product','receipt') NOT NULL,
	`file_key` varchar(120) NOT NULL,
	`mime` varchar(40) NOT NULL,
	`width` int,
	`height` int,
	`bytes` int,
	`variants_json` json,
	`alt_text` varchar(160),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`section_id` bigint unsigned NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(300),
	`price_gs` bigint,
	`media_id` bigint unsigned,
	`is_available` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `menu_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menu_sections` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`name` varchar(80) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `menu_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `onboarding_tokens` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`token` char(32) NOT NULL,
	`business_id` bigint unsigned,
	`phone` varchar(20),
	`prefill_json` json,
	`created_by_user_id` bigint unsigned NOT NULL,
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `onboarding_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_token` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`page_slug` varchar(60) NOT NULL,
	`type` enum('servicios','nosotros','galeria','menu','productos','contacto','custom') NOT NULL,
	`title` varchar(120) NOT NULL,
	`content_json` json,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_biz_pageslug` UNIQUE(`business_id`,`page_slug`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`subscription_id` bigint unsigned NOT NULL,
	`amount_gs` bigint NOT NULL,
	`method` enum('transferencia','giros','efectivo','tigo_money','billetera_personal','zimple','tarjeta','otro') NOT NULL,
	`reference` varchar(120),
	`receipt_media_id` bigint unsigned,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`status` enum('reported','confirmed','rejected') NOT NULL DEFAULT 'reported',
	`confirmed_by_user_id` bigint unsigned,
	`confirmed_at` datetime,
	`notes` varchar(300),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(300),
	`price_gs` bigint,
	`media_id` bigint unsigned,
	`is_visible` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slug_redirects` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`old_slug` varchar(60) NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `slug_redirects_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_old_slug` UNIQUE(`old_slug`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`plan` enum('basico','plus','pro') NOT NULL DEFAULT 'basico',
	`price_gs` bigint NOT NULL,
	`starts_at` date NOT NULL,
	`expires_at` date NOT NULL,
	`status` enum('trial','active','grace','expired','canceled') NOT NULL DEFAULT 'active',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`role` enum('superadmin','owner') NOT NULL DEFAULT 'owner',
	`name` varchar(120) NOT NULL,
	`email` varchar(190),
	`phone` varchar(20),
	`password_hash` varchar(100),
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`last_login_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_email` UNIQUE(`email`),
	CONSTRAINT `u_phone` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`phone` varchar(20) NOT NULL,
	`business_id` bigint unsigned,
	`user_id` bigint unsigned,
	`purpose` enum('onboarding','login','phone_change') NOT NULL,
	`code_hash` char(64) NOT NULL,
	`channel` enum('whatsapp_manual','whatsapp_api') NOT NULL,
	`attempts` tinyint unsigned NOT NULL DEFAULT 0,
	`expires_at` datetime NOT NULL,
	`verified_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `i_biz` ON `activity_log` (`business_id`);--> statement-breakpoint
CREATE INDEX `i_action` ON `activity_log` (`action`);--> statement-breakpoint
CREATE INDEX `i_biz_created` ON `analytics_events` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `i_biz_type_created` ON `analytics_events` (`business_id`,`type`,`created_at`);--> statement-breakpoint
CREATE INDEX `i_status` ON `businesses` (`status`);--> statement-breakpoint
CREATE INDEX `i_category` ON `businesses` (`category`);--> statement-breakpoint
CREATE INDEX `i_hotlead` ON `businesses` (`hot_lead`);--> statement-breakpoint
CREATE INDEX `i_biz_kind` ON `media` (`business_id`,`kind`);--> statement-breakpoint
CREATE INDEX `i_biz_section` ON `menu_items` (`business_id`,`section_id`);--> statement-breakpoint
CREATE INDEX `i_biz` ON `menu_sections` (`business_id`);--> statement-breakpoint
CREATE INDEX `i_biz` ON `payments` (`business_id`);--> statement-breakpoint
CREATE INDEX `i_status` ON `payments` (`status`);--> statement-breakpoint
CREATE INDEX `i_biz` ON `products` (`business_id`);--> statement-breakpoint
CREATE INDEX `i_biz` ON `subscriptions` (`business_id`);--> statement-breakpoint
CREATE INDEX `i_expires` ON `subscriptions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `i_phone_purpose` ON `verifications` (`phone`,`purpose`);