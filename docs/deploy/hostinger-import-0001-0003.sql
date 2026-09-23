-- Hostinger (MariaDB 11.8): migrations 0001–0003 in one phpMyAdmin import.
-- Prepared 2026-09-23 after round 3 batch 3 (docs/log/R3-3.md).
--
-- Safe to run more than once, and safe if 0001 was already imported in
-- batch 2: every statement is guarded, and a journal row is only added when
-- its hash is missing. Same SQL as drizzle/0001–0003, plus the guards.
-- Tested on MariaDB 10.11 from a 0000-only database, imported twice, then
-- `npm run db:migrate` reported nothing left to apply.
--
-- Before importing: replace the database name on the next line with the
-- app's database (hPanel → Databases). A server-level import needs it.
USE `CHANGE_ME_DATABASE`;

-- 0001 (R3-10): settings table for the promo switch.
CREATE TABLE IF NOT EXISTS `settings` (
	`key` varchar(64) NOT NULL,
	`value` text NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);

-- 0002 (R3-17): products_view analytics event.
ALTER TABLE `analytics_events` MODIFY COLUMN `type` enum('page_view','whatsapp_click','phone_click','map_click','social_click','menu_view','gallery_view','products_view') NOT NULL;

-- 0003 (R3-18): which button was clicked.
ALTER TABLE `analytics_events` ADD COLUMN IF NOT EXISTS `cta_loc` varchar(32);

-- Drizzle's journal: one row per migration, so a later db:migrate skips them.
INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
  SELECT '534edf6cb2b9c1f74d3e3dfea095861b660a7126eb4cad5da12eea565b6069c4', 1789436708540 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM `__drizzle_migrations` WHERE `hash` = '534edf6cb2b9c1f74d3e3dfea095861b660a7126eb4cad5da12eea565b6069c4');
INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
  SELECT 'bbd9822c450ce9d66bd87529b8b89d14b94cf305dfe1dc4fc87c18c7d628ec7b', 1790115212529 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM `__drizzle_migrations` WHERE `hash` = 'bbd9822c450ce9d66bd87529b8b89d14b94cf305dfe1dc4fc87c18c7d628ec7b');
INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
  SELECT 'd389fa4d6c0affbe4254210fa4d6893b1e12b3fa9ca538de0eaf654507aff829', 1790116229456 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM `__drizzle_migrations` WHERE `hash` = 'd389fa4d6c0affbe4254210fa4d6893b1e12b3fa9ca538de0eaf654507aff829');

-- Check: expect 4 rows (0000–0003) and a cta_loc column.
SELECT `id`, `created_at` FROM `__drizzle_migrations` ORDER BY `id`;
SHOW COLUMNS FROM `analytics_events` LIKE 'cta_loc';
