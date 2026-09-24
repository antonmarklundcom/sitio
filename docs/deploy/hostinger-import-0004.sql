-- Hostinger (MariaDB 11.8): migration 0004 (growth-1) in one phpMyAdmin import.
-- Prepared 2026-09-24 (docs/log/growth-1.md). Import AFTER
-- hostinger-import-0001-0003.sql.
--
-- Safe to run more than once: every statement is guarded (IF NOT EXISTS), and
-- the journal row is only added when its hash is missing. Same SQL as
-- drizzle/0004_growth.sql, plus the guards (the unique constraint on
-- referral_code becomes an equivalent guarded unique index). Tested on
-- MariaDB 10.11 from a 0000–0003 database, imported twice, then
-- `npm run db:migrate` reported nothing left to apply.
--
-- Before importing: replace the database name on the next line with the
-- app's database (hPanel → Databases). A server-level import needs it.
USE `CHANGE_ME_DATABASE`;

CREATE TABLE IF NOT EXISTS `outbound_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`kind` varchar(32) NOT NULL,
	`period_key` varchar(32) NOT NULL,
	`channel` enum('manual','api') NOT NULL DEFAULT 'manual',
	`actor_user_id` bigint unsigned,
	`sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `outbound_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_biz_kind_period` UNIQUE(`business_id`,`kind`,`period_key`)
);
CREATE TABLE IF NOT EXISTS `partner_commissions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`partner_id` bigint unsigned NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`payment_id` bigint unsigned NOT NULL,
	`amount_gs` bigint NOT NULL,
	`status` enum('pending','paid','void') NOT NULL DEFAULT 'pending',
	`paid_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `partner_commissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_payment` UNIQUE(`payment_id`)
);
CREATE TABLE IF NOT EXISTS `partners` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`phone` varchar(20),
	`code` varchar(16) NOT NULL,
	`commission_pct` tinyint unsigned NOT NULL DEFAULT 30,
	`token` char(32) NOT NULL,
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`notes` varchar(300),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `partners_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_partner_code` UNIQUE(`code`),
	CONSTRAINT `u_partner_token` UNIQUE(`token`)
);
CREATE TABLE IF NOT EXISTS `service_requests` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`service_key` varchar(40) NOT NULL,
	`service_title` varchar(120) NOT NULL,
	`status` enum('nuevo','contactado','vendido','descartado') NOT NULL DEFAULT 'nuevo',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `service_requests_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `site_leads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`kind` enum('consulta','turno') NOT NULL DEFAULT 'consulta',
	`name` varchar(80) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`message` varchar(600),
	`service_name` varchar(120),
	`requested_day` date,
	`requested_time` varchar(5),
	`status` enum('nuevo','contactado','cerrado') NOT NULL DEFAULT 'nuevo',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `site_leads_id` PRIMARY KEY(`id`)
);
ALTER TABLE `businesses` ADD COLUMN IF NOT EXISTS `site_options_json` json;
ALTER TABLE `businesses` ADD COLUMN IF NOT EXISTS `google_review_url` varchar(300);
ALTER TABLE `businesses` ADD COLUMN IF NOT EXISTS `referral_code` varchar(16);
ALTER TABLE `businesses` ADD COLUMN IF NOT EXISTS `referred_by_business_id` bigint unsigned;
ALTER TABLE `businesses` ADD COLUMN IF NOT EXISTS `partner_id` bigint unsigned;
ALTER TABLE `businesses` ADD COLUMN IF NOT EXISTS `referral_rewarded_at` datetime;
ALTER TABLE `businesses` ADD COLUMN IF NOT EXISTS `needs_review` boolean DEFAULT false NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS `u_referral_code` ON `businesses` (`referral_code`);
CREATE INDEX IF NOT EXISTS `i_partner_status` ON `partner_commissions` (`partner_id`,`status`);
CREATE INDEX IF NOT EXISTS `i_status` ON `service_requests` (`status`);
CREATE INDEX IF NOT EXISTS `i_biz` ON `service_requests` (`business_id`);
CREATE INDEX IF NOT EXISTS `i_biz_status` ON `site_leads` (`business_id`,`status`);
CREATE INDEX IF NOT EXISTS `i_biz_created` ON `site_leads` (`business_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `i_partner` ON `businesses` (`partner_id`);
CREATE INDEX IF NOT EXISTS `i_referred_by` ON `businesses` (`referred_by_business_id`);

-- Drizzle's journal: one row, so a later db:migrate skips 0004.
INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
  SELECT 'dbe89137bbbc0abecd945f1ae1466a8bf5f4a649dfd2ddb75acaba0b3ca48d05', 1790279275676 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM `__drizzle_migrations` WHERE `hash` = 'dbe89137bbbc0abecd945f1ae1466a8bf5f4a649dfd2ddb75acaba0b3ca48d05');

-- Check: expect 5 rows (0000–0004) and the new tables.
SELECT `id`, `created_at` FROM `__drizzle_migrations` ORDER BY `id`;
SHOW TABLES LIKE 'site_leads';
SHOW COLUMNS FROM `businesses` LIKE 'referral_code';
