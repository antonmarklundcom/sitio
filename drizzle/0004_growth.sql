CREATE TABLE `outbound_messages` (
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
--> statement-breakpoint
CREATE TABLE `partner_commissions` (
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
--> statement-breakpoint
CREATE TABLE `partners` (
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
--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`business_id` bigint unsigned NOT NULL,
	`service_key` varchar(40) NOT NULL,
	`service_title` varchar(120) NOT NULL,
	`status` enum('nuevo','contactado','vendido','descartado') NOT NULL DEFAULT 'nuevo',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `service_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_leads` (
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
--> statement-breakpoint
ALTER TABLE `businesses` ADD `site_options_json` json;--> statement-breakpoint
ALTER TABLE `businesses` ADD `google_review_url` varchar(300);--> statement-breakpoint
ALTER TABLE `businesses` ADD `referral_code` varchar(16);--> statement-breakpoint
ALTER TABLE `businesses` ADD `referred_by_business_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `businesses` ADD `partner_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `businesses` ADD `referral_rewarded_at` datetime;--> statement-breakpoint
ALTER TABLE `businesses` ADD `needs_review` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD CONSTRAINT `u_referral_code` UNIQUE(`referral_code`);--> statement-breakpoint
CREATE INDEX `i_partner_status` ON `partner_commissions` (`partner_id`,`status`);--> statement-breakpoint
CREATE INDEX `i_status` ON `service_requests` (`status`);--> statement-breakpoint
CREATE INDEX `i_biz` ON `service_requests` (`business_id`);--> statement-breakpoint
CREATE INDEX `i_biz_status` ON `site_leads` (`business_id`,`status`);--> statement-breakpoint
CREATE INDEX `i_biz_created` ON `site_leads` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `i_partner` ON `businesses` (`partner_id`);--> statement-breakpoint
CREATE INDEX `i_referred_by` ON `businesses` (`referred_by_business_id`);