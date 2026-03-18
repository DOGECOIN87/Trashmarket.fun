CREATE TABLE `airdrop_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`twitterHandle` varchar(256) NOT NULL,
	`twitterId` varchar(64) NOT NULL,
	`gorbaganaWallet` varchar(256) NOT NULL,
	`registeredAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `airdrop_registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `airdrop_registrations_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `airdrop_registrations_twitterId_unique` UNIQUE(`twitterId`)
);
--> statement-breakpoint
ALTER TABLE `airdrop_registrations` ADD CONSTRAINT `airdrop_registrations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;