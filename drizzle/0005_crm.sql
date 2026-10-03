CREATE TABLE `push_subscriptions` (
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
--> statement-breakpoint
ALTER TABLE `site_leads` MODIFY COLUMN `kind` enum('consulta','turno','whatsapp','manual') NOT NULL DEFAULT 'consulta';--> statement-breakpoint
ALTER TABLE `site_leads` MODIFY COLUMN `status` enum('nuevo','contactado','cliente','perdido','cerrado') NOT NULL DEFAULT 'nuevo';--> statement-breakpoint
ALTER TABLE `analytics_events` ADD `ref_code` varchar(8);--> statement-breakpoint
ALTER TABLE `businesses` ADD `notify_email` varchar(190);--> statement-breakpoint
ALTER TABLE `site_leads` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `site_leads` ADD `follow_up_day` date;--> statement-breakpoint
ALTER TABLE `site_leads` ADD `value_gs` bigint;--> statement-breakpoint
ALTER TABLE `site_leads` ADD `contacted_at` datetime;--> statement-breakpoint
ALTER TABLE `site_leads` ADD `source` varchar(40);--> statement-breakpoint
ALTER TABLE `site_leads` ADD `source_path` varchar(120);--> statement-breakpoint
ALTER TABLE `site_leads` ADD `ref_code` varchar(8);--> statement-breakpoint
CREATE INDEX `i_biz` ON `push_subscriptions` (`business_id`);--> statement-breakpoint
CREATE INDEX `i_biz_ref` ON `analytics_events` (`business_id`,`ref_code`);--> statement-breakpoint
CREATE INDEX `i_biz_followup` ON `site_leads` (`business_id`,`follow_up_day`);--> statement-breakpoint
CREATE INDEX `i_biz_phone` ON `site_leads` (`business_id`,`phone`);