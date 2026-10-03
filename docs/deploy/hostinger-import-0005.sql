-- Hostinger (MariaDB 11.8): migration 0005 (crm-1) in one phpMyAdmin import.
-- Import AFTER hostinger-import-0004.sql.
--
-- Safe to run more than once: every statement is guarded (IF NOT EXISTS), the
-- two enum MODIFYs only widen the allowed values, and the journal row is only
-- added when its hash is missing. Same SQL as drizzle/0005_crm.sql plus the
-- guards.
--
-- Before importing: replace the database name on the next line with the
-- app's database (hPanel → Databases). A server-level import needs it.
USE `CHANGE_ME_DATABASE`;

CREATE TABLE IF NOT EXISTS `push_subscriptions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`endpoint_hash` char(64) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` varchar(200) NOT NULL,
	`auth` varchar(64) NOT NULL,
	`user_agent` varchar(160),
	`failures` tinyint unsigned NOT NULL DEFAULT 0,
	`last_ok_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `u_endpoint` UNIQUE(`endpoint_hash`)
);
ALTER TABLE `site_leads` MODIFY COLUMN `kind` enum('consulta','turno','whatsapp','manual') NOT NULL DEFAULT 'consulta';
ALTER TABLE `site_leads` MODIFY COLUMN `status` enum('nuevo','contactado','cliente','perdido','cerrado') NOT NULL DEFAULT 'nuevo';
ALTER TABLE `analytics_events` ADD COLUMN IF NOT EXISTS `ref_code` varchar(8);
ALTER TABLE `businesses` ADD COLUMN IF NOT EXISTS `notify_email` varchar(190);
ALTER TABLE `site_leads` ADD COLUMN IF NOT EXISTS `notes` text;
ALTER TABLE `site_leads` ADD COLUMN IF NOT EXISTS `follow_up_day` date;
ALTER TABLE `site_leads` ADD COLUMN IF NOT EXISTS `value_gs` bigint;
ALTER TABLE `site_leads` ADD COLUMN IF NOT EXISTS `contacted_at` datetime;
ALTER TABLE `site_leads` ADD COLUMN IF NOT EXISTS `source` varchar(40);
ALTER TABLE `site_leads` ADD COLUMN IF NOT EXISTS `source_path` varchar(120);
ALTER TABLE `site_leads` ADD COLUMN IF NOT EXISTS `ref_code` varchar(8);
CREATE INDEX IF NOT EXISTS `i_biz` ON `push_subscriptions` (`business_id`);
CREATE INDEX IF NOT EXISTS `i_biz_ref` ON `analytics_events` (`business_id`,`ref_code`);
CREATE INDEX IF NOT EXISTS `i_biz_followup` ON `site_leads` (`business_id`,`follow_up_day`);
CREATE INDEX IF NOT EXISTS `i_biz_phone` ON `site_leads` (`business_id`,`phone`);

-- Drizzle's journal: one row, so a later db:migrate skips 0005.
INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
  SELECT '19239d470bcdce4274e6d5a41c04d3892e2bab71c944d73f53232d23935ebed0', 1791043351253 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM `__drizzle_migrations` WHERE `hash` = '19239d470bcdce4274e6d5a41c04d3892e2bab71c944d73f53232d23935ebed0');

-- Check: expect 6 rows (0000–0005) and the new table/columns.
SELECT `id`, `created_at` FROM `__drizzle_migrations` ORDER BY `id`;
SHOW TABLES LIKE 'push_subscriptions';
SHOW COLUMNS FROM `site_leads` LIKE 'follow_up_day';
