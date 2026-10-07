CREATE TABLE `encrypted_finance_states` (
	`user_id` text PRIMARY KEY NOT NULL,
	`encrypted_payload` text NOT NULL,
	`wrapped_key` text NOT NULL,
	`salt` text NOT NULL,
	`wrap_iv` text NOT NULL,
	`data_iv` text NOT NULL,
	`crypto_version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
