CREATE TABLE `recognition_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`started` integer NOT NULL,
	`finished` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recognition_started_idx` ON `recognition_requests` (`started`);--> statement-breakpoint
CREATE INDEX `recognition_owner_started_idx` ON `recognition_requests` (`owner`,`started`);