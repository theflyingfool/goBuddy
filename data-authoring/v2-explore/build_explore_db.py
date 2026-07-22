#!/usr/bin/env python3
"""
V2 exploration DB — NOT part of the app or the real ingestion pipeline.

Pulls every pogoapi.net endpoint and pokemon-go-api's pokedex/raid/type data
into raw/, then loads it all into one throwaway SQLite file so we can run ad
hoc SQL to see what actually links across sources (and what doesn't) before
committing to a real schema. See docs/v2-schema-design.md for the design
this is meant to inform, and docs/v2-data-source-findings.md for the sourcing
decisions already made.

Usage:
    python3 build_explore_db.py [--skip-fetch]

Output: data-authoring/v2-explore/explore.sqlite (gitignored, not shipped).
"""

import json
import sqlite3
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "raw"
DB_PATH = HERE / "explore.sqlite"

POGOAPI_ENDPOINTS = [
    "alolan_pokemon", "api_hashes", "baby_pokemon", "badges", "charged_moves",
    "community_days", "cp_multiplier", "current_pokemon_moves", "fast_moves",
    "friendship_level_settings", "galarian_pokemon", "gobattle_league_rewards",
    "gobattle_ranking_settings", "levelup_rewards", "mega_evolution_settings",
    "mega_pokemon", "nesting_pokemon", "photobomb_exclusive_pokemon",
    "player_xp_requirements", "pokemon_buddy_distances",
    "pokemon_candy_to_evolve", "pokemon_encounter_data", "pokemon_evolutions",
    "pokemon_forms", "pokemon_genders", "pokemon_generations",
    "pokemon_height_weight_scale", "pokemon_max_cp", "pokemon_names",
    "pokemon_powerup_requirements", "pokemon_rarity", "pokemon_stats",
    "pokemon_types", "possible_ditto_pokemon", "pvp_charged_moves",
    "pvp_exclusive_pokemon", "pvp_fast_moves", "raid_bosses",
    "raid_exclusive_pokemon", "raid_settings", "released_pokemon",
    "research_task_exclusive_pokemon", "shadow_pokemon", "shiny_pokemon",
    "time_limited_shiny_pokemon", "type_effectiveness", "weather_boosts",
]

PGAPI_BASE = "https://pokemon-go-api.github.io/pokemon-go-api/api"
PGAPI_FILES = {
    "pgapi_pokedex.json": f"{PGAPI_BASE}/pokedex.json",
    "pgapi_raidboss.json": f"{PGAPI_BASE}/raidboss.json",
    "pgapi_types.json": f"{PGAPI_BASE}/types.json",
    "pgapi_mega.json": f"{PGAPI_BASE}/pokedex/mega.json",
}


def fetch(url: str, dest: Path) -> None:
    if dest.exists():
        print(f"  skip (cached): {dest.name}")
        return
    print(f"  fetching: {dest.name}")
    with urllib.request.urlopen(url) as resp:
        dest.write_bytes(resp.read())


def fetch_all() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    print("pogoapi.net:")
    for name in POGOAPI_ENDPOINTS:
        fetch(f"https://pogoapi.net/api/v1/{name}.json", RAW / f"{name}.json")
    print("pokemon-go-api:")
    for filename, url in PGAPI_FILES.items():
        fetch(url, RAW / filename)


def load_json(name: str):
    path = RAW / name
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


RECORD_ID_KEYS = ("id", "pokemon_id", "name", "community_day_number", "move_id", "level", "rank")


def is_record(v) -> bool:
    return isinstance(v, dict) and any(k in v for k in RECORD_ID_KEYS)


def flatten_records(obj, group_key=None):
    """Yield (group_key, record_dict) for anything that looks like an entity
    record, walking one level into dicts/lists that group records together."""
    if isinstance(obj, list):
        for item in obj:
            if is_record(item):
                yield (group_key, item)
            elif isinstance(item, (list, dict)):
                yield from flatten_records(item, group_key)
    elif isinstance(obj, dict):
        if is_record(obj):
            yield (group_key, obj)
        else:
            for k, v in obj.items():
                yield from flatten_records(v, k)


def build_pogoapi_raw(cur: sqlite3.Cursor) -> None:
    cur.execute(
        """CREATE TABLE pogoapi_raw (
            source_file TEXT NOT NULL,
            group_key TEXT,
            pokemon_id INTEGER,
            form TEXT,
            name TEXT,
            data_json TEXT NOT NULL
        )"""
    )
    cur.execute("CREATE INDEX idx_pogoapi_raw_source ON pogoapi_raw(source_file)")
    cur.execute("CREATE INDEX idx_pogoapi_raw_pokemon_id ON pogoapi_raw(pokemon_id)")

    for name in POGOAPI_ENDPOINTS:
        data = load_json(f"{name}.json")
        if data is None:
            print(f"  MISSING: {name}.json (not fetched)")
            continue
        rows = list(flatten_records(data))
        if not rows:
            # Flat scalar config (e.g. raid_settings, mega_evolution_settings)
            # — store as a single row so it's still queryable.
            cur.execute(
                "INSERT INTO pogoapi_raw (source_file, group_key, pokemon_id, form, name, data_json) "
                "VALUES (?, NULL, NULL, NULL, NULL, ?)",
                (f"{name}.json", json.dumps(data)),
            )
            continue
        for group_key, rec in rows:
            pokemon_id = rec.get("pokemon_id", rec.get("id"))
            if not isinstance(pokemon_id, int):
                pokemon_id = None
            form = rec.get("form")
            rec_name = rec.get("pokemon_name", rec.get("name"))
            cur.execute(
                "INSERT INTO pogoapi_raw (source_file, group_key, pokemon_id, form, name, data_json) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (f"{name}.json", str(group_key) if group_key is not None else None,
                 pokemon_id, form, rec_name, json.dumps(rec)),
            )
    print(f"  pogoapi_raw: {cur.execute('SELECT COUNT(*) FROM pogoapi_raw').fetchone()[0]} rows")


def build_pgapi_tables(cur: sqlite3.Cursor) -> None:
    pokedex = load_json("pgapi_pokedex.json")
    if pokedex is None:
        print("  MISSING: pgapi_pokedex.json (not fetched)")
        return

    cur.execute(
        """CREATE TABLE pgapi_species (
            id TEXT NOT NULL,
            form_id TEXT PRIMARY KEY,
            dex_nr INTEGER NOT NULL,
            name TEXT,
            generation INTEGER,
            has_mega INTEGER,
            has_gmax INTEGER,
            data_json TEXT NOT NULL
        )"""
    )
    cur.execute("CREATE INDEX idx_pgapi_species_dex_nr ON pgapi_species(dex_nr)")

    cur.execute(
        """CREATE TABLE pgapi_asset_form (
            dex_nr INTEGER NOT NULL,
            species_form_id TEXT NOT NULL,
            form TEXT,
            costume TEXT,
            is_female INTEGER,
            image TEXT,
            shiny_image TEXT
        )"""
    )
    cur.execute("CREATE INDEX idx_pgapi_asset_form_dex_nr ON pgapi_asset_form(dex_nr)")

    cur.execute(
        """CREATE TABLE pgapi_region_form (
            parent_form_id TEXT NOT NULL,
            form_id TEXT NOT NULL,
            dex_nr INTEGER NOT NULL,
            data_json TEXT NOT NULL
        )"""
    )
    cur.execute("CREATE INDEX idx_pgapi_region_form_dex_nr ON pgapi_region_form(dex_nr)")

    cur.execute(
        """CREATE TABLE pgapi_mega_form (
            dex_nr INTEGER NOT NULL,
            species_form_id TEXT NOT NULL,
            mega_form_id TEXT NOT NULL,
            energy_cost INTEGER,
            data_json TEXT NOT NULL
        )"""
    )
    cur.execute("CREATE INDEX idx_pgapi_mega_form_dex_nr ON pgapi_mega_form(dex_nr)")

    cur.execute(
        """CREATE TABLE pgapi_evolution (
            from_dex_nr INTEGER NOT NULL,
            from_form_id TEXT NOT NULL,
            to_id TEXT NOT NULL,
            to_form_id TEXT,
            candies INTEGER,
            item TEXT,
            data_json TEXT NOT NULL
        )"""
    )
    cur.execute("CREATE INDEX idx_pgapi_evolution_from ON pgapi_evolution(from_dex_nr)")

    def insert_species_row(entry):
        cur.execute(
            "INSERT OR REPLACE INTO pgapi_species (id, form_id, dex_nr, name, generation, has_mega, has_gmax, data_json) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                entry["id"], entry["formId"], entry["dexNr"], (entry.get("names") or {}).get("English"),
                entry.get("generation"),
                int(bool(entry.get("hasMegaEvolution"))), int(bool(entry.get("hasGigantamaxEvolution"))),
                json.dumps(entry),
            ),
        )
        dex_nr = entry["dexNr"]
        form_id = entry["formId"]

        for af in entry.get("assetForms") or []:
            cur.execute(
                "INSERT INTO pgapi_asset_form (dex_nr, species_form_id, form, costume, is_female, image, shiny_image) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (dex_nr, form_id, af.get("form"), af.get("costume"),
                 int(bool(af.get("isFemale"))), af.get("image"), af.get("shinyImage")),
            )

        for mega_id, mega in (entry.get("megaEvolutions") or {}).items():
            cur.execute(
                "INSERT INTO pgapi_mega_form (dex_nr, species_form_id, mega_form_id, energy_cost, data_json) "
                "VALUES (?, ?, ?, ?, ?)",
                (dex_nr, form_id, mega_id, mega.get("energyCost"), json.dumps(mega)),
            )

        for evo in entry.get("evolutions") or []:
            cur.execute(
                "INSERT INTO pgapi_evolution (from_dex_nr, from_form_id, to_id, to_form_id, candies, item, data_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (dex_nr, form_id, evo.get("id"), evo.get("formId"), evo.get("candies"),
                 (evo.get("item") or {}).get("id") if isinstance(evo.get("item"), dict) else evo.get("item"),
                 json.dumps(evo)),
            )

        for region_form_id, region_entry in (entry.get("regionForms") or {}).items():
            cur.execute(
                "INSERT INTO pgapi_region_form (parent_form_id, form_id, dex_nr, data_json) "
                "VALUES (?, ?, ?, ?)",
                (form_id, region_form_id, region_entry.get("dexNr", dex_nr), json.dumps(region_entry)),
            )
            # Region forms can themselves carry assetForms/evolutions/mega —
            # recurse one level so those aren't silently dropped.
            insert_species_row(region_entry)

    for entry in pokedex:
        insert_species_row(entry)

    print(f"  pgapi_species: {cur.execute('SELECT COUNT(*) FROM pgapi_species').fetchone()[0]} rows")
    print(f"  pgapi_asset_form: {cur.execute('SELECT COUNT(*) FROM pgapi_asset_form').fetchone()[0]} rows")
    print(f"  pgapi_region_form: {cur.execute('SELECT COUNT(*) FROM pgapi_region_form').fetchone()[0]} rows")
    print(f"  pgapi_mega_form: {cur.execute('SELECT COUNT(*) FROM pgapi_mega_form').fetchone()[0]} rows")
    print(f"  pgapi_evolution: {cur.execute('SELECT COUNT(*) FROM pgapi_evolution').fetchone()[0]} rows")

    # Raid bosses (pokemon-go-api's own list, separate from pogoapi.net's)
    raidboss = load_json("pgapi_raidboss.json")
    cur.execute(
        """CREATE TABLE pgapi_raid_boss (
            tier TEXT NOT NULL,
            dex_nr INTEGER,
            form TEXT,
            costume TEXT,
            data_json TEXT NOT NULL
        )"""
    )
    if raidboss:
        for tier, entries in (raidboss.get("currentList") or {}).items():
            for e in entries:
                cur.execute(
                    "INSERT INTO pgapi_raid_boss (tier, dex_nr, form, costume, data_json) VALUES (?, ?, ?, ?, ?)",
                    (tier, e.get("dexNr"), e.get("form"), e.get("costume"), json.dumps(e)),
                )
    print(f"  pgapi_raid_boss: {cur.execute('SELECT COUNT(*) FROM pgapi_raid_boss').fetchone()[0]} rows")

    # Types (combined type-effectiveness + weather boost)
    types_data = load_json("pgapi_types.json")
    cur.execute("CREATE TABLE pgapi_type (type TEXT PRIMARY KEY, data_json TEXT NOT NULL)")
    if types_data:
        for t in types_data:
            cur.execute("INSERT INTO pgapi_type (type, data_json) VALUES (?, ?)", (t["type"], json.dumps(t)))
    print(f"  pgapi_type: {cur.execute('SELECT COUNT(*) FROM pgapi_type').fetchone()[0]} rows")


def run_sanity_checks(cur: sqlite3.Cursor) -> None:
    print("\n--- sanity checks ---")

    cur.execute(
        "SELECT COUNT(*) FROM pgapi_species s "
        "JOIN pogoapi_raw p ON p.pokemon_id = s.dex_nr AND p.source_file = 'pokemon_stats.json'"
    )
    print(f"pgapi_species <-> pogoapi pokemon_stats, joinable rows: {cur.fetchone()[0]}")

    cur.execute(
        "SELECT s.dex_nr, s.id FROM pgapi_species s "
        "WHERE s.form_id = s.id "  # base forms only
        "AND NOT EXISTS (SELECT 1 FROM pogoapi_raw p WHERE p.source_file = 'pokemon_stats.json' AND p.pokemon_id = s.dex_nr)"
    )
    missing = cur.fetchall()
    print(f"pgapi base-form species with NO pogoapi pokemon_stats match: {len(missing)} (e.g. {missing[:5]})")

    cur.execute("SELECT COUNT(DISTINCT costume) FROM pgapi_asset_form WHERE costume IS NOT NULL")
    print(f"distinct pgapi costume tokens: {cur.fetchone()[0]}")

    cur.execute(
        "SELECT COUNT(DISTINCT json_extract(data_json, '$.form')) FROM pogoapi_raw "
        "WHERE source_file = 'pokemon_stats.json'"
    )
    print(f"distinct pogoapi.net 'form' tokens (pokemon_stats.json): {cur.fetchone()[0]}")
    print("(these two token sets are the confirmed-mismatched vocabularies — see v2-data-source-findings.md §8)")


def main() -> None:
    if "--skip-fetch" not in sys.argv:
        fetch_all()
    else:
        print("skipping fetch, using cached raw/ files")

    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("\nbuilding pogoapi_raw ...")
    build_pogoapi_raw(cur)

    print("\nbuilding pgapi_* tables ...")
    build_pgapi_tables(cur)

    conn.commit()
    run_sanity_checks(cur)
    conn.close()

    print(f"\nDone: {DB_PATH}")


if __name__ == "__main__":
    main()
