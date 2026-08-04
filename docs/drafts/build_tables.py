#!/usr/bin/env python3
# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "duckdb>=1.5.5",
#     "pandas>=3.0.5",
# ]
# ///
"""
Build an exploration DuckDB database from GAME_MASTER.json.

Requirements:
    pip install duckdb pandas

Input:
    GAME_MASTER.json

Output:
    gameMaster.duckdb

Creates:
    raw_json            - Original imported JSON
    templates           - Flattened templateId/record_id/json_data
    schema_inventory    - One row per record_id with inferred schema
    one table per record_id
    import_errors       - Anything that failed to import

The generated tables are intended for EXPLORATION only.
"""

import json
import re
from pathlib import Path

import duckdb
import pandas as pd

JSON_FILE = "GAME_MASTER.json"
DB_FILE = "gameMaster.duckdb"

if not Path(JSON_FILE).exists():
    raise FileNotFoundError(f"{JSON_FILE} not found.")

print("Loading JSON...")

with open(JSON_FILE, "r", encoding="utf-8") as f:
    game_master = json.load(f)

print("Opening DuckDB...")

db = duckdb.connect(DB_FILE)

# ------------------------------------------------------------------------------
# Cleanup from previous runs
# ------------------------------------------------------------------------------

db.execute("DROP TABLE IF EXISTS raw_json")
db.execute("DROP TABLE IF EXISTS templates")
db.execute("DROP TABLE IF EXISTS schema_inventory")
db.execute("DROP TABLE IF EXISTS import_errors")

# ------------------------------------------------------------------------------
# Stage 1 - Raw JSON
# ------------------------------------------------------------------------------

print("Creating raw_json...")

raw_df = pd.DataFrame(game_master)

db.register("raw_df", raw_df)

db.execute("""
CREATE TABLE raw_json AS
SELECT *
FROM raw_df
""")

# ------------------------------------------------------------------------------
# Stage 2 - Explode template map
# ------------------------------------------------------------------------------

print("Creating templates...")

rows = []

for item in game_master:

    template_id = item.get("templateId")

    data = item.get("data")

    if not isinstance(data, dict):
        continue

    for record_id, json_data in data.items():
        rows.append({
            "templateId": template_id,
            "record_id": record_id,
            "json_data": json.dumps(json_data)
        })

templates_df = pd.DataFrame(rows)

db.register("templates_df", templates_df)

db.execute("""
CREATE TABLE templates AS
SELECT *
FROM templates_df
""")

print(f"Templates: {len(templates_df):,}")

# ------------------------------------------------------------------------------
# Stage 3 - Schema Inventory
# ------------------------------------------------------------------------------

print("Building schema inventory...")

schema_rows = []

for record_id, group in templates_df.groupby("record_id"):

    merged = {}

    for js in group["json_data"]:
        try:
            obj = json.loads(js)

            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k not in merged:
                        merged[k] = type(v).__name__

        except Exception:
            pass

    schema_rows.append({
        "record_id": record_id,
        "row_count": len(group),
        "fields": json.dumps(sorted(merged.keys()), indent=2)
    })

schema_df = pd.DataFrame(schema_rows)

db.register("schema_df", schema_df)

db.execute("""
CREATE TABLE schema_inventory AS
SELECT *
FROM schema_df
""")

print(f"Schemas: {len(schema_df):,}")

# ------------------------------------------------------------------------------
# Stage 4 - Create one table per record_id
# ------------------------------------------------------------------------------

print("Creating exploration tables...")

errors = []

created = 0

for record_id, group in templates_df.groupby("record_id"):

    try:

        table_name = re.sub(r"[^0-9A-Za-z_]", "_", str(record_id))
        table_name = table_name.lower()

        # Flatten JSON
        flattened = pd.json_normalize(
            group["json_data"].apply(json.loads)
        )

        # Insert templateId first
        flattened.insert(
            0,
            "templateId",
            group["templateId"].values
        )

        db.register("tmp_table", flattened)

        db.execute(f'DROP TABLE IF EXISTS "{table_name}"')

        db.execute(f'''
            CREATE TABLE "{table_name}" AS
            SELECT *
            FROM tmp_table
        ''')

        created += 1

    except Exception as ex:

        errors.append({
            "record_id": record_id,
            "error": str(ex)
        })

# ------------------------------------------------------------------------------
# Stage 5 - Import Errors
# ------------------------------------------------------------------------------

errors_df = pd.DataFrame(errors)

db.register("errors_df", errors_df)

db.execute("""
CREATE TABLE import_errors AS
SELECT *
FROM errors_df
""")

# ------------------------------------------------------------------------------
# Done
# ------------------------------------------------------------------------------

print()
print("=" * 60)
print("Finished")
print("=" * 60)
print(f"Created tables : {created}")
print(f"Failed tables  : {len(errors)}")
print(f"Database       : {DB_FILE}")

db.close()

# # /// script
# # requires-python = ">=3.14"
# # dependencies = [
# #     "duckdb>=1.5.5",
# # ]
# # ///
# import duckdb

# db = duckdb.connect("gameMaster.duckdb")
# con = duckdb.connect("exploration.duckdb")
# # rows = db.execute("""
# # SELECT record_id, structure
# # FROM schema_inventory
# # """).fetchall()

# # with open("build_tables.sql", "w") as f:
# #     for record_id, structure in rows:
# #         table_name = "tbl_" + record_id.lower()

# #         f.write(f"""
# # CREATE TABLE "{table_name}" AS
# # SELECT
# #     templateId,
# #     json_transform(json_data, '{structure.replace("'", "''")}').*
# # FROM templates
# # WHERE record_id = '{record_id.replace("'", "''")}';

# # """)

# rows = con.execute("SELECT record_id, structure FROM schema_inventory WHERE record_id IS NOT NULL").fetchall()

# with open('output.sql', 'w') as f:
#     f.write("-- DuckDB Native Inferred Table Creation Script\n\n")

#     for rec_id, structure in rows:
#         safe_rec_id = str(rec_id).replace(" ", "_")
        
#         # Escape single quotes just in case, so it doesn't break our SQL string
#         safe_structure = structure.replace("'", "''")

#         f.write(f"-- Building table: tbl_{safe_rec_id}\n")
#         f.write(f"DROP TABLE IF EXISTS tbl_{safe_rec_id};\n")
        
#         # If the inferred structure starts with '[', DuckDB knows it's an array of records.
#         # We use UNNEST() to explode the array into individual rows first, then unpack columns.
#         if safe_structure.strip().startswith('['):
#             f.write(f"CREATE TABLE tbl_{safe_rec_id} AS \n")
#             f.write(f"SELECT (unnest(from_json(json_data, '{safe_structure}'))).*\n")
#             f.write(f"FROM templates \nWHERE record_id = '{rec_id}';\n\n")
            
#         # If it's just a standard JSON object, we unpack the columns directly.
#         else:
#             f.write(f"CREATE TABLE tbl_{safe_rec_id} AS \n")
#             f.write(f"SELECT (from_json(json_data, '{safe_structure}')).*\n")
#             f.write(f"FROM templates \nWHERE record_id = '{rec_id}';\n\n")

# print(f"Success! output.sql generated to build {len(rows)} tables using DuckDB's native inference.")