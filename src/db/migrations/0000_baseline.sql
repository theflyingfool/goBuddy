-- Hand-edited after `npm run db:generate`: restores REFERENCES clauses
-- pointing at reference tables (species, form, mega_variant, backgrounds,
-- medal, player_level), which live in src/db/schema/reference.ts and are
-- deliberately excluded from drizzle-kit's schema path. Any future
-- drizzle-kit generate that touches one of the columns below must repeat
-- this hand-edit — drizzle-kit does not know these tables exist.
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `form_background_personal` (
	`form_slug` text NOT NULL REFERENCES form(slug),
	`profile_id` integer DEFAULT 1 NOT NULL REFERENCES profile(id),
	`achievement_field` text NOT NULL,
	`background_slug` text NOT NULL REFERENCES backgrounds(slug),
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`form_slug`, `achievement_field`, `background_slug`)
);
--> statement-breakpoint
CREATE TABLE `form_personal` (
	`form_slug` text PRIMARY KEY NOT NULL REFERENCES form(slug),
	`profile_id` integer DEFAULT 1 NOT NULL REFERENCES profile(id),
	`caught` integer DEFAULT false NOT NULL,
	`shiny` integer DEFAULT false NOT NULL,
	`floor` integer DEFAULT false NOT NULL,
	`four_star` integer DEFAULT false NOT NULL,
	`shundo` integer DEFAULT false NOT NULL,
	`lucky` integer DEFAULT false NOT NULL,
	`lucky_shiny` integer DEFAULT false NOT NULL,
	`lucky_floor` integer DEFAULT false NOT NULL,
	`lucky_four_star` integer DEFAULT false NOT NULL,
	`lucky_shundo` integer DEFAULT false NOT NULL,
	`shadow` integer DEFAULT false NOT NULL,
	`shadow_shiny` integer DEFAULT false NOT NULL,
	`shadow_floor` integer DEFAULT false NOT NULL,
	`shadow_four_star` integer DEFAULT false NOT NULL,
	`shadow_shundo` integer DEFAULT false NOT NULL,
	`dynamax` integer DEFAULT false NOT NULL,
	`dynamax_floor` integer DEFAULT false NOT NULL,
	`dynamax_shiny` integer DEFAULT false NOT NULL,
	`dynamax_four_star` integer DEFAULT false NOT NULL,
	`dynamax_shundo` integer DEFAULT false NOT NULL,
	`lucky_dynamax` integer DEFAULT false NOT NULL,
	`lucky_dynamax_floor` integer DEFAULT false NOT NULL,
	`lucky_dynamax_shiny` integer DEFAULT false NOT NULL,
	`lucky_dynamax_four_star` integer DEFAULT false NOT NULL,
	`lucky_dynamax_shundo` integer DEFAULT false NOT NULL,
	`best_shiny` text,
	`best_non_shiny` text,
	`best_lucky` text,
	`updated_at` integer NOT NULL,
	CONSTRAINT "form_personal_caught_bool" CHECK("form_personal"."caught" IN (0, 1)),
	CONSTRAINT "form_personal_shiny_bool" CHECK("form_personal"."shiny" IN (0, 1)),
	CONSTRAINT "form_personal_floor_bool" CHECK("form_personal"."floor" IN (0, 1)),
	CONSTRAINT "form_personal_fourStar_bool" CHECK("form_personal"."four_star" IN (0, 1)),
	CONSTRAINT "form_personal_shundo_bool" CHECK("form_personal"."shundo" IN (0, 1)),
	CONSTRAINT "form_personal_lucky_bool" CHECK("form_personal"."lucky" IN (0, 1)),
	CONSTRAINT "form_personal_luckyShiny_bool" CHECK("form_personal"."lucky_shiny" IN (0, 1)),
	CONSTRAINT "form_personal_luckyFloor_bool" CHECK("form_personal"."lucky_floor" IN (0, 1)),
	CONSTRAINT "form_personal_luckyFourStar_bool" CHECK("form_personal"."lucky_four_star" IN (0, 1)),
	CONSTRAINT "form_personal_luckyShundo_bool" CHECK("form_personal"."lucky_shundo" IN (0, 1)),
	CONSTRAINT "form_personal_shadow_bool" CHECK("form_personal"."shadow" IN (0, 1)),
	CONSTRAINT "form_personal_shadowShiny_bool" CHECK("form_personal"."shadow_shiny" IN (0, 1)),
	CONSTRAINT "form_personal_shadowFloor_bool" CHECK("form_personal"."shadow_floor" IN (0, 1)),
	CONSTRAINT "form_personal_shadowFourStar_bool" CHECK("form_personal"."shadow_four_star" IN (0, 1)),
	CONSTRAINT "form_personal_shadowShundo_bool" CHECK("form_personal"."shadow_shundo" IN (0, 1)),
	CONSTRAINT "form_personal_dynamax_bool" CHECK("form_personal"."dynamax" IN (0, 1)),
	CONSTRAINT "form_personal_dynamaxFloor_bool" CHECK("form_personal"."dynamax_floor" IN (0, 1)),
	CONSTRAINT "form_personal_dynamaxShiny_bool" CHECK("form_personal"."dynamax_shiny" IN (0, 1)),
	CONSTRAINT "form_personal_dynamaxFourStar_bool" CHECK("form_personal"."dynamax_four_star" IN (0, 1)),
	CONSTRAINT "form_personal_dynamaxShundo_bool" CHECK("form_personal"."dynamax_shundo" IN (0, 1)),
	CONSTRAINT "form_personal_luckyDynamax_bool" CHECK("form_personal"."lucky_dynamax" IN (0, 1)),
	CONSTRAINT "form_personal_luckyDynamaxFloor_bool" CHECK("form_personal"."lucky_dynamax_floor" IN (0, 1)),
	CONSTRAINT "form_personal_luckyDynamaxShiny_bool" CHECK("form_personal"."lucky_dynamax_shiny" IN (0, 1)),
	CONSTRAINT "form_personal_luckyDynamaxFourStar_bool" CHECK("form_personal"."lucky_dynamax_four_star" IN (0, 1)),
	CONSTRAINT "form_personal_luckyDynamaxShundo_bool" CHECK("form_personal"."lucky_dynamax_shundo" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `medal_progress_personal` (
	`medal_slug` text NOT NULL REFERENCES medal(slug),
	`profile_id` integer DEFAULT 1 NOT NULL REFERENCES profile(id),
	`current_rank` integer DEFAULT 0 NOT NULL,
	`current_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`medal_slug`, `profile_id`)
);
--> statement-breakpoint
CREATE TABLE `mega_personal` (
	`mega_variant_slug` text PRIMARY KEY NOT NULL REFERENCES mega_variant(slug),
	`profile_id` integer DEFAULT 1 NOT NULL REFERENCES profile(id),
	`evolved` integer DEFAULT false NOT NULL,
	`shiny_evolved` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "mega_personal_evolved_bool" CHECK("mega_personal"."evolved" IN (0, 1)),
	CONSTRAINT "mega_personal_shinyEvolved_bool" CHECK("mega_personal"."shiny_evolved" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `personal_data_quarantine` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_table` text NOT NULL,
	`slug` text NOT NULL,
	`payload_json` text NOT NULL,
	`quarantined_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `player_progress_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer DEFAULT 1 NOT NULL REFERENCES profile(id),
	`recorded_at` integer NOT NULL,
	`current_level` integer,
	`total_xp` integer
);
--> statement-breakpoint
CREATE TABLE `player_progress_personal` (
	`profile_id` integer PRIMARY KEY NOT NULL REFERENCES profile(id),
	`current_level` integer REFERENCES player_level(level),
	`total_xp` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pokemon_instance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`form_slug` text NOT NULL REFERENCES form(slug),
	`profile_id` integer NOT NULL REFERENCES profile(id),
	`status` text DEFAULT 'kept' NOT NULL,
	`recorded_at` integer NOT NULL,
	`caught_at` integer,
	`updated_at` integer NOT NULL,
	`cp` integer,
	`iv_percent` real,
	`shiny` integer DEFAULT false NOT NULL,
	`lucky` integer DEFAULT false NOT NULL,
	`shadow` integer DEFAULT false NOT NULL,
	`purified` integer DEFAULT false NOT NULL,
	`hearts_earned` integer,
	`current_mega_level` integer,
	`nickname` text,
	`background_slug` text REFERENCES backgrounds(slug),
	CONSTRAINT "pokemon_instance_shiny_bool" CHECK("pokemon_instance"."shiny" IN (0, 1)),
	CONSTRAINT "pokemon_instance_lucky_bool" CHECK("pokemon_instance"."lucky" IN (0, 1)),
	CONSTRAINT "pokemon_instance_shadow_bool" CHECK("pokemon_instance"."shadow" IN (0, 1)),
	CONSTRAINT "pokemon_instance_purified_bool" CHECK("pokemon_instance"."purified" IN (0, 1)),
	CONSTRAINT "pokemon_instance_status_enum" CHECK("pokemon_instance"."status" IN ('kept', 'traded', 'released', 'evolved'))
);
--> statement-breakpoint
CREATE TABLE `pokemon_instance_max_move` (
	`pokemon_instance_id` integer NOT NULL REFERENCES pokemon_instance(id),
	`move_slot` text NOT NULL,
	`level` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`pokemon_instance_id`, `move_slot`)
);
--> statement-breakpoint
CREATE TABLE `pokemon_instance_tag` (
	`pokemon_instance_id` integer NOT NULL REFERENCES pokemon_instance(id),
	`tag_id` integer NOT NULL REFERENCES tag(id),
	PRIMARY KEY(`pokemon_instance_id`, `tag_id`)
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`friend_code` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `species_personal` (
	`species_slug` text PRIMARY KEY NOT NULL REFERENCES species(slug),
	`profile_id` integer DEFAULT 1 NOT NULL REFERENCES profile(id),
	`registered` integer DEFAULT false NOT NULL,
	`xxl` integer DEFAULT false NOT NULL,
	`xxs` integer DEFAULT false NOT NULL,
	`purified` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "species_personal_registered_bool" CHECK("species_personal"."registered" IN (0, 1)),
	CONSTRAINT "species_personal_xxl_bool" CHECK("species_personal"."xxl" IN (0, 1)),
	CONSTRAINT "species_personal_xxs_bool" CHECK("species_personal"."xxs" IN (0, 1)),
	CONSTRAINT "species_personal_purified_bool" CHECK("species_personal"."purified" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL REFERENCES profile(id),
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_profile_id_name_unique` ON `tag` (`profile_id`,`name`);