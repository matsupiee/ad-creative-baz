CREATE TABLE `ad_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`ad_id` text NOT NULL,
	`region` text NOT NULL,
	`period` integer NOT NULL,
	`order_by` text NOT NULL,
	`rank` integer,
	`likes` integer,
	`play_count` integer,
	`shares` integer,
	`captured_at` integer NOT NULL,
	FOREIGN KEY (`ad_id`) REFERENCES `ads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ad_snapshots_ad_captured_idx` ON `ad_snapshots` (`ad_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `ad_snapshots_region_period_captured_idx` ON `ad_snapshots` (`region`,`period`,`captured_at`);--> statement-breakpoint
CREATE TABLE `ad_transcripts` (
	`ad_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`raw_text` text,
	`refined_text` text,
	`language` text,
	`model_whisper` text,
	`model_refiner` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`ad_id`) REFERENCES `ads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ad_transcripts_status_idx` ON `ad_transcripts` (`status`);--> statement-breakpoint
CREATE TABLE `ads` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text DEFAULT 'tiktok' NOT NULL,
	`source_material_id` text NOT NULL,
	`title` text,
	`brand` text,
	`industry` text,
	`video_vid` text,
	`video_url` text,
	`cover_url` text,
	`duration_seconds` integer,
	`likes` integer,
	`play_count` integer,
	`shares` integer,
	`region` text NOT NULL,
	`period` integer NOT NULL,
	`order_by` text NOT NULL,
	`rank` integer,
	`first_seen_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`last_seen_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ads_source_material_idx` ON `ads` (`source`,`source_material_id`);--> statement-breakpoint
CREATE INDEX `ads_region_period_likes_idx` ON `ads` (`region`,`period`,`likes`);--> statement-breakpoint
CREATE INDEX `ads_region_period_play_idx` ON `ads` (`region`,`period`,`play_count`);--> statement-breakpoint
CREATE INDEX `ads_deleted_at_idx` ON `ads` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `ads_last_seen_idx` ON `ads` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);