CREATE TABLE `finance_states` (
	`user_id` text PRIMARY KEY NOT NULL,
	`debts_json` text DEFAULT '[]' NOT NULL,
	`expenses_json` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL
);
