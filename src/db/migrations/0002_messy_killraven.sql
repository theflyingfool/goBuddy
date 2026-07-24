-- Hand-edited after `npm run db:generate`, per 0000_baseline.sql's header
-- comment ("any future drizzle-kit generate that touches one of the columns
-- below must repeat this hand-edit") and 0001_timestamps_to_epoch_ms.sql's
-- header comment (same reasoning, applied there to a ten-table rebuild).
-- Two fixes were needed here, both verified empirically with the sqlite3
-- CLI against a throwaway file DB before and after:
--
-- (1) Restored the REFERENCES clauses on `form_slug` (-> form(slug)),
-- `profile_id` (-> profile(id)), and `background_slug` (-> backgrounds(slug))
-- that drizzle-kit's rebuild drops, because those clauses were hand-added to
-- earlier migrations and were never present on the Drizzle schema objects
-- themselves (`formSlug`/`profileId`/`backgroundSlug` in
-- src/db/schema/personal.ts carry no `.references()` call).
--
-- (2) drizzle-kit's raw INSERT...SELECT for the table-rebuild both (a) tried
-- to SELECT "iv_attack", "iv_defense", "iv_stamina" from the *old*
-- `pokemon_instance` table, which doesn't have those columns yet (this
-- migration is what introduces them) -- confirmed empirically: this raises
-- "no such column: iv_attack" -- and (b) listed "iv_percent" as an INSERT
-- target column, which SQLite rejects outright for a GENERATED column --
-- confirmed empirically: "cannot INSERT into generated column iv_percent".
-- Fixed by dropping all four columns from both the INSERT column list and
-- the SELECT list; iv_attack/iv_defense/iv_stamina land NULL (their column
-- default) for every pre-existing row, and iv_percent is computed by SQLite
-- itself from those (NULL, per its CASE expression) on read.
--
-- This migration only touches one table, so unlike 0001 there is no
-- multi-table FK-ordering hazard to fix: drizzle-kit's OFF-before/ON-after
-- bracketing around this single CREATE/INSERT/DROP/RENAME sequence is
-- already correct as generated -- confirmed empirically by applying the
-- rest of this file unmodified (REFERENCES targets pre-exist from earlier
-- migrations by the time this one runs).
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pokemon_instance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`form_slug` text NOT NULL REFERENCES form(slug),
	`profile_id` integer NOT NULL REFERENCES profile(id),
	`status` text DEFAULT 'kept' NOT NULL,
	`recorded_at` integer NOT NULL,
	`caught_at` integer,
	`updated_at` integer NOT NULL,
	`cp` integer,
	`iv_attack` integer,
	`iv_defense` integer,
	`iv_stamina` integer,
	`iv_percent` real GENERATED ALWAYS AS (CASE WHEN iv_attack IS NOT NULL AND iv_defense IS NOT NULL AND iv_stamina IS NOT NULL THEN ROUND((iv_attack + iv_defense + iv_stamina) * 100.0 / 45, 1) ELSE NULL END) VIRTUAL,
	`shiny` integer DEFAULT false NOT NULL,
	`lucky` integer DEFAULT false NOT NULL,
	`shadow` integer DEFAULT false NOT NULL,
	`purified` integer DEFAULT false NOT NULL,
	`hearts_earned` integer,
	`current_mega_level` integer,
	`nickname` text,
	`background_slug` text REFERENCES backgrounds(slug),
	CONSTRAINT "pokemon_instance_shiny_bool" CHECK("__new_pokemon_instance"."shiny" IN (0, 1)),
	CONSTRAINT "pokemon_instance_lucky_bool" CHECK("__new_pokemon_instance"."lucky" IN (0, 1)),
	CONSTRAINT "pokemon_instance_shadow_bool" CHECK("__new_pokemon_instance"."shadow" IN (0, 1)),
	CONSTRAINT "pokemon_instance_purified_bool" CHECK("__new_pokemon_instance"."purified" IN (0, 1)),
	CONSTRAINT "pokemon_instance_status_enum" CHECK("__new_pokemon_instance"."status" IN ('kept', 'traded', 'released', 'evolved')),
	CONSTRAINT "pokemon_instance_iv_attack_range" CHECK("__new_pokemon_instance"."iv_attack" IS NULL OR ("__new_pokemon_instance"."iv_attack" >= 0 AND "__new_pokemon_instance"."iv_attack" <= 15)),
	CONSTRAINT "pokemon_instance_iv_defense_range" CHECK("__new_pokemon_instance"."iv_defense" IS NULL OR ("__new_pokemon_instance"."iv_defense" >= 0 AND "__new_pokemon_instance"."iv_defense" <= 15)),
	CONSTRAINT "pokemon_instance_iv_stamina_range" CHECK("__new_pokemon_instance"."iv_stamina" IS NULL OR ("__new_pokemon_instance"."iv_stamina" >= 0 AND "__new_pokemon_instance"."iv_stamina" <= 15))
);
--> statement-breakpoint
INSERT INTO `__new_pokemon_instance`("id", "form_slug", "profile_id", "status", "recorded_at", "caught_at", "updated_at", "cp", "shiny", "lucky", "shadow", "purified", "hearts_earned", "current_mega_level", "nickname", "background_slug") SELECT "id", "form_slug", "profile_id", "status", "recorded_at", "caught_at", "updated_at", "cp", "shiny", "lucky", "shadow", "purified", "hearts_earned", "current_mega_level", "nickname", "background_slug" FROM `pokemon_instance`;--> statement-breakpoint
DROP TABLE `pokemon_instance`;--> statement-breakpoint
ALTER TABLE `__new_pokemon_instance` RENAME TO `pokemon_instance`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
