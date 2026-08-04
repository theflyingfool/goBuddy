#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "duckdb>=1.0.0",
#     "pandas>=2.0.0",
#     "requests>=2.31.0",
# ]
# ///
"""Quick, disposable pull-everything-into-one-duckdb script.

Not part of the fetch-verification-pipeline plan (shelved, see
docs/superpowers/plans/2026-08-04-fetch-verification-pipeline-plan.md) --
this is a standalone tool for manually exploring raw upstream data + the
existing reference.json shim, all in one file, to work out normalization
by hand. No retry/discovery/registry/report machinery.

Usage:
    uv run python3 exploration/pull_and_explore.py --fetch   # pull raw data
    uv run python3 exploration/pull_and_explore.py --build   # load into duckdb
    uv run python3 exploration/pull_and_explore.py --fetch --build

Layout:
    exploration/raw/<source>/<endpoint>.json   -- raw pulls
    exploration/exploration.duckdb             -- everything loaded, one table per endpoint
"""

import argparse
import json
import re
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List

import duckdb
import pandas as pd
import requests

REPO_ROOT = Path(__file__).parent.parent.resolve()
EXPLORATION_DIR = Path(__file__).parent.resolve()
RAW_DIR = EXPLORATION_DIR / "raw"
DB_PATH = EXPLORATION_DIR / "exploration.duckdb"

_CAMEL_TO_SNAKE_RE = re.compile(r"(?<!^)(?=[A-Z])")


def camel_to_snake(name: str) -> str:
    return _CAMEL_TO_SNAKE_RE.sub("_", name).lower()


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def _get_json(url: str, timeout: int = 30) -> Any:
    res = requests.get(url, timeout=timeout)
    res.raise_for_status()
    return res.json()


def _save(raw_source_dir: Path, filename: str, data: Any) -> None:
    raw_source_dir.mkdir(parents=True, exist_ok=True)
    with open(raw_source_dir / filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def fetch_pogoapi_net() -> None:
    """Pulls EVERY file pogoapi.net lists in its own api_hashes.json listing
    (47 files as of 2026-08-04), not just the 19 in config/sources.yml --
    "grab everything" for this source, since it's cheap (small static files)."""
    out_dir = RAW_DIR / "pogoapi_net"
    hashes = _get_json("https://pogoapi.net/api/v1/api_hashes.json")
    for filename in sorted(hashes.keys()):
        if filename == "api_hashes.json":
            continue
        print(f"[pogoapi_net] {filename}")
        try:
            data = _get_json(f"https://pogoapi.net/api/v1/{filename}")
            _save(out_dir, filename, data)
        except Exception as e:
            print(f"[pogoapi_net] WARNING: {filename} failed: {e}")


def fetch_pokemon_go_api() -> None:
    """Top-level api/*.json files only -- skips the api/pokedex/ subdirectory
    of per-species detail files (huge, and pokedex.json already aggregates
    this) and hashes.json (metadata, not data)."""
    out_dir = RAW_DIR / "pokemon_go_api"
    base = "https://pokemon-go-api.github.io/pokemon-go-api/api"
    for filename in ["pokedex.json", "maxbattles.json", "raidboss.json", "quests.json", "types.json"]:
        print(f"[pokemon_go_api] {filename}")
        try:
            data = _get_json(f"{base}/{filename}")
            _save(out_dir, filename, data)
        except Exception as e:
            print(f"[pokemon_go_api] WARNING: {filename} failed: {e}")


def fetch_pokeapi() -> None:
    """Only the 4 categories already known to matter (pokemon, species, type,
    move). PokeAPI has 50+ categories total, but full detail for e.g. every
    individual pokemon/move requires one HTTP request PER item (thousands) --
    out of scope for a quick script. Revisit deliberately if more is needed."""
    out_dir = RAW_DIR / "pokeapi"
    base = "https://pokeapi.co/api/v2"
    categories = ["pokemon", "pokemon-species", "type", "move"]
    for category in categories:
        filename = category.replace("-", "_") + ".json"
        print(f"[pokeapi] {filename}")
        try:
            data = _get_json(f"{base}/{category}?limit=1025")
            _save(out_dir, filename, data)
        except Exception as e:
            print(f"[pokeapi] WARNING: {filename} failed: {e}")


def fetch_alexelgt_game_masters() -> None:
    out_dir = RAW_DIR / "alexelgt_game_masters"
    print("[alexelgt_game_masters] GAME_MASTER.json (large, ~19MB)")
    data = _get_json("https://raw.githubusercontent.com/alexelgt/game_masters/master/GAME_MASTER.json", timeout=60)
    _save(out_dir, "GAME_MASTER.json", data)


def fetch_pvpoke() -> None:
    out_dir = RAW_DIR / "pvpoke"
    print("[pvpoke] gamemaster.json")
    data = _get_json("https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json", timeout=60)
    _save(out_dir, "gamemaster.json", data)


def fetch_rplus_shiny() -> None:
    out_dir = RAW_DIR / "rplus_shiny"
    print("[rplus_shiny] shiny_releases.json")
    data = _get_json("https://opensheet.elk.sh/13UreWc5Nq4yiLYvDRt2RyPWXsDx9y4pMWhSD0JsnHCw/1")
    _save(out_dir, "shiny_releases.json", data)


def fetch_local_authoring() -> None:
    out_dir = RAW_DIR / "local_authoring"
    out_dir.mkdir(parents=True, exist_ok=True)
    costume_lookup = REPO_ROOT / "data-authoring" / "costume-lookup.json"
    if costume_lookup.exists():
        print("[local_authoring] costume-lookup.json")
        shutil.copy2(costume_lookup, out_dir / "costume-lookup.json")
    else:
        print("[local_authoring] WARNING: costume-lookup.json not found")

    community_submissions = REPO_ROOT / "data-authoring" / "community-submissions.json"
    if community_submissions.exists():
        print("[local_authoring] community-submissions.json")
        shutil.copy2(community_submissions, out_dir / "community-submissions.json")
    else:
        print("[local_authoring] community-submissions.json does not exist yet, skipping")


def fetch_all() -> None:
    fetch_pogoapi_net()
    fetch_pokemon_go_api()
    fetch_pokeapi()
    fetch_alexelgt_game_masters()
    fetch_pvpoke()
    fetch_rplus_shiny()
    fetch_local_authoring()


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def _load_file_as_table(con: duckdb.DuckDBPyConnection, table_name: str, path: Path) -> int:
    con.execute(f'DROP TABLE IF EXISTS "{table_name}"')
    con.execute(f'CREATE TABLE "{table_name}" AS SELECT * FROM read_json_auto(\'{path.as_posix()}\')')
    count = con.execute(f'SELECT count(*) FROM "{table_name}"').fetchone()[0]
    return count


def _load_records_as_table(con: duckdb.DuckDBPyConnection, table_name: str, records: List[Dict[str, Any]]) -> int:
    con.execute(f'DROP TABLE IF EXISTS "{table_name}"')
    if not records:
        con.execute(f'CREATE TABLE "{table_name}" (placeholder VARCHAR)')
        return 0
    df = pd.DataFrame(records)
    try:
        con.register("tmp_df", df)
        con.execute(f'CREATE TABLE "{table_name}" AS SELECT * FROM tmp_df')
        con.unregister("tmp_df")
        return len(df)
    except Exception as e:
        # Mixed-type columns (e.g. a field that's sometimes bool, sometimes
        # int across rows -- seen in pvpoke's `pokemon.thirdMoveCost`) can
        # trip up DuckDB's pandas conversion. Fall back to per-column JSON
        # strings rather than losing the table entirely -- still explorable,
        # just not natively typed.
        print(f"    WARNING: {table_name} native load failed ({e}); falling back to JSON-string columns")
        try:
            con.unregister("tmp_df")
        except Exception:
            pass
        json_records = [{k: json.dumps(v) for k, v in rec.items()} for rec in records]
        df = pd.DataFrame(json_records)
        con.register("tmp_df", df)
        con.execute(f'CREATE TABLE "{table_name}" AS SELECT * FROM tmp_df')
        con.unregister("tmp_df")
        return len(df)


def build_flat_source(con: duckdb.DuckDBPyConnection, source_key: str) -> None:
    source_dir = RAW_DIR / source_key
    if not source_dir.exists():
        print(f"[{source_key}] no raw data, skipping (run --fetch first)")
        return
    for path in sorted(source_dir.glob("*.json")):
        table_name = f"{source_key}_{path.stem}"
        count = _load_file_as_table(con, table_name, path)
        print(f"  {table_name}: {count} rows")


def build_alexelgt_game_masters(con: duckdb.DuckDBPyConnection) -> None:
    """Every GAME_MASTER.json entry has exactly one shape-key under `data`
    besides `templateId` (verified against a full 18,672-entry dump,
    202 distinct shape-keys) -- one agm_<snake_case_shape_key> table per
    group, each row keeping template_id as an identifying column."""
    path = RAW_DIR / "alexelgt_game_masters" / "GAME_MASTER.json"
    if not path.exists():
        print("[alexelgt_game_masters] no raw data, skipping (run --fetch first)")
        return
    with open(path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    groups: Dict[str, List[Dict[str, Any]]] = {}
    for entry in entries:
        data = entry.get("data", {})
        shape_keys = [k for k in data.keys() if k != "templateId"]
        if not shape_keys:
            groups.setdefault("_no_shape_key", []).append({"template_id": entry.get("templateId")})
            continue
        shape_key = shape_keys[0]
        payload = data[shape_key]
        row = {"template_id": entry.get("templateId")}
        if isinstance(payload, dict):
            row.update(payload)
        else:
            row["value"] = payload
        groups.setdefault(shape_key, []).append(row)

    for shape_key, records in sorted(groups.items()):
        table_name = f"agm_{camel_to_snake(shape_key)}"
        count = _load_records_as_table(con, table_name, records)
        print(f"  {table_name}: {count} rows")


def build_pvpoke(con: duckdb.DuckDBPyConnection) -> None:
    """pvpoke's gamemaster.json is a dict of top-level keys; each key whose
    value is a list of objects becomes its own pvgm_<snake_case_key> table.
    Scalar/dict-only top-level keys (timestamp, id, title, settings,
    pokemonTraits) are skipped -- verified live during planning."""
    path = RAW_DIR / "pvpoke" / "gamemaster.json"
    if not path.exists():
        print("[pvpoke] no raw data, skipping (run --fetch first)")
        return
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for key, value in data.items():
        if not isinstance(value, list) or not value or not isinstance(value[0], dict):
            print(f"  pvgm_{camel_to_snake(key)}: skipped (not a list of objects)")
            continue
        table_name = f"pvgm_{camel_to_snake(key)}"
        count = _load_records_as_table(con, table_name, value)
        print(f"  {table_name}: {count} rows")


def build_rplus_shiny(con: duckdb.DuckDBPyConnection) -> None:
    path = RAW_DIR / "rplus_shiny" / "shiny_releases.json"
    if not path.exists():
        print("[rplus_shiny] no raw data, skipping (run --fetch first)")
        return
    count = _load_file_as_table(con, "rplus_shiny_releases", path)
    print(f"  rplus_shiny_releases: {count} rows")


def build_local_authoring(con: duckdb.DuckDBPyConnection) -> None:
    costume_path = RAW_DIR / "local_authoring" / "costume-lookup.json"
    if costume_path.exists():
        count = _load_file_as_table(con, "la_cos_lookup", costume_path)
        print(f"  la_cos_lookup: {count} rows")
    else:
        print("[local_authoring] no costume-lookup.json in raw data, skipping (run --fetch first)")

    submissions_path = RAW_DIR / "local_authoring" / "community-submissions.json"
    if submissions_path.exists():
        count = _load_file_as_table(con, "la_com_submissions", submissions_path)
        print(f"  la_com_submissions: {count} rows")
    else:
        print("[local_authoring] community-submissions.json not present, skipping")


def build_refjson(con: duckdb.DuckDBPyConnection) -> None:
    """Reuses the existing src/reference_shim.py loader as-is, pointed at
    this exploration db instead of output/GoRefs_Master.duckdb."""
    con.close()  # load_reference_json_shim opens its own connection to DB_PATH
    sys.path.insert(0, str(REPO_ROOT))
    from src.reference_shim import load_reference_json_shim

    row_counts = load_reference_json_shim(db_path=DB_PATH)
    for table_name, count in sorted(row_counts.items()):
        print(f"  {table_name}: {count} rows")


def build_all() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB_PATH))

    print("pogoapi_net:")
    build_flat_source(con, "pogoapi_net")
    print("pokemon_go_api:")
    build_flat_source(con, "pokemon_go_api")
    print("pokeapi:")
    build_flat_source(con, "pokeapi")
    print("alexelgt_game_masters:")
    build_alexelgt_game_masters(con)
    print("pvpoke:")
    build_pvpoke(con)
    print("rplus_shiny:")
    build_rplus_shiny(con)
    print("local_authoring:")
    build_local_authoring(con)

    print("refjson (reference.json shim):")
    build_refjson(con)  # closes `con` itself, see docstring

    print(f"\nDone. {DB_PATH}")


# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="Pull fresh raw data for every source")
    parser.add_argument("--build", action="store_true", help="Load raw data in exploration/raw/ into exploration.duckdb")
    args = parser.parse_args()

    if not args.fetch and not args.build:
        print("Usage: pull_and_explore.py [--fetch] [--build]")
        sys.exit(0)

    if args.fetch:
        fetch_all()
    if args.build:
        build_all()


if __name__ == "__main__":
    main()
