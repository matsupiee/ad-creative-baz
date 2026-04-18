ALTER TABLE `ads` ADD `video_url_expires_at` integer;--> statement-breakpoint
CREATE INDEX `ads_region_period_expires_idx` ON `ads` (`region`,`period`,`video_url_expires_at`);