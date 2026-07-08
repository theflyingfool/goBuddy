# Data model & storage design

Detailed rationale behind the storage architecture and reference-data pipeline.
CLAUDE.md carries the condensed invariants; this file is the full reference.
The *actual* schema is defined in code (`src/db/schema.ts`, `src/db/types.ts`) —
the DDL block below is the reasoned proposal it grew from, kept for the design
rationale in its comments.

## Storage

- **SQLite on-device** via `capacitor-community/sqlite`. No IndexedDB, no
  browser storage — this is a native-wrapped app, so there's no reason to
  target browser-only APIs.
- Two logical groups of tables, separated so that app updates can never
  destroy user data:
  - **Reference tables** — the Pokédex itself (species, forms, mega variants,
    types, regions, backgrounds). Wholesale replaceable on every update. The
    app owns this data, not the user.
  - **Personal tables** — the user's own achievement state. Never written by
    an update, only by user interaction.
- Every reference row has a **permanent, immutable slug** as its primary key
  (e.g. `bulbasaur-standard-male`, `charizard-mega-x`), generated once and
  never reused or reassigned across versions. Personal-data rows reference
  reference rows by this slug (foreign key). This is what makes reference-table
  replacement safe — as long as slugs are stable, updating the dex never
  orphans a user's data.
- All achievement/personal facts are **real boolean columns**, not list
  values or JSON blobs. This was a deliberate reversal from an earlier
  Obsidian-based design that used list properties — that pattern existed
  only to work around Markdown frontmatter's limits and isn't idiomatic for
  a real relational schema. Combined milestones (e.g. a shiny + perfect-IV
  individual, i.e. "shundo") are **independently stored facts, never
  computed from other booleans** — two independently-true flags (e.g. owns
  *a* shiny, owns *a* hundo) do not imply the same individual was both, so
  the combined fact must be its own column, entered/verified independently.
- Include a small schema-version table and a migration runner for personal
  data, so future additions to the personal schema can run a one-time
  migration on load without touching reference data.

## Versioning policy — two separate mechanisms, don't conflate them

There are two independent version numbers in this codebase. Bumping the
wrong one (or neither) when the underlying thing changes is the failure
mode to avoid:

- **`CURRENT_PERSONAL_SCHEMA_VERSION`** (`src/db/schema.ts`) — covers the
  *structure* of the personal tables (`species_personal`, `form_personal`,
  etc.), not their contents. Bump this by hand, and append a matching
  `{ version, up }` entry to `MIGRATIONS` in `src/db/migrations.ts`,
  **whenever a personal-table column is added, removed, renamed, or its
  meaning changes** (e.g. adding a new achievement boolean like
  `four_star_dynamax`). This is also the version number stamped into
  Settings → Export files and checked on Import (see
  `src/data/repository.ts`'s `PersonalDataExport`), so an out-of-date bump
  here would let a structurally-mismatched export get imported without
  warning.
- **`reference_data_version`** (`src/db/reference-sync.ts`) — covers the
  *contents* of `src/data/reference.json` (new species, new forms, new
  costumes, corrected flags, etc.). This one is **automatic** — it's a
  content hash of the whole file, recomputed and compared on every app
  start, and triggers a reference-table wipe-and-reload whenever the file
  changes. **Nothing to bump by hand here**: adding new Pokémon or editing
  existing reference data (via the ingestion pipeline or CSV tools) is
  enough on its own; the version updates itself.

In short: touching `reference.json` (new Pokémon, new forms/costumes, data
corrections) needs no manual version bump. Touching the *shape* of a
personal table in `schema.ts` needs both a `CURRENT_PERSONAL_SCHEMA_VERSION`
bump and a migration entry.

## Suggested schema (starting point, not a mandate)

This is a reasoned proposal reflecting how the game's mechanics actually
work, not a fixed spec. If you (Claude Code) notice something that would be
better modeled differently — a missing edge case, a normalization that
doesn't hold, a game mechanic this gets wrong — propose the change and ask
rather than silently deviating or silently complying. I'd rather be asked
than have you guess.

```
REFERENCE (replaceable wholesale on every update, keyed by permanent slug)

species
  slug PK, dex_number, name, family_slug,
  gen, rarity (standard | legendary | mythical | ultra_beast),
  region_slug FK -> regions,
  has_male bool, has_female bool,   -- both false = genderless/unknown (e.g. Ditto)
  can_mega_evolve bool              -- mega is species-wide, never form-specific
                                     -- (confirmed: shadow Pokémon can never
                                     -- mega regardless of species — this is
                                     -- a universal game rule, not per-species
                                     -- data, so it's enforced in app logic
                                     -- rather than needing its own flag)

regions
  slug PK, name

types
  slug PK, name

backgrounds
  slug PK, name

form                     -- one row per catchable form/costume/gigantamax,
                          -- SPLIT BY GENDER: every species with has_male
                          -- and/or has_female true gets separate form rows
                          -- per gender per form/costume (not just visually
                          -- distinct species — split everything, per
                          -- decision to prioritize DB-cheap completeness
                          -- over Obsidian-era tedium)
  slug PK, species_slug FK,
  form_name, costume_name (nullable),
  gender (male | female | unknown),
  evolves bool,           -- varies per form (costumes often can't evolve;
                           -- this is separate from mega, which doesn't vary)
  shiny_available bool,
  shadow_available bool,
  dynamax_available bool,
  regional_exclusive bool,
  image_ref

form_types                -- many-to-many (dual typing)
  form_slug FK, type_slug FK

mega_variant               -- one row per (species, X/Y/Primal) that's real
  slug PK, species_slug FK, variant (X | Y | Primal | null)


PERSONAL (never touched by reference updates)

species_personal
  species_slug FK/PK,
  registered, xxl, xxs, purified              -- bool

form_personal
  form_slug FK/PK,

  caught bool,
  floor bool,                    -- lowest possible IV for a NORMAL catch —
                                  -- usually 0/0/0, occasionally raised on
                                  -- some legendaries. NOT assumed to mean
                                  -- literal 0/0/0.
  four_star bool,
  shundo bool,                   -- independently stored, see note above

  lucky bool,
  lucky_floor bool,               -- lowest possible for lucky (~10/10/10,
                                   -- verify exact value, not load-bearing)
  lucky_four_star bool,
  lucky_shundo bool,

  shadow bool,
  shadow_floor bool,              -- lowest possible for shadow — 0/0/0
                                   -- typically, raised floor on some
                                   -- raid-sourced shadows
  shadow_four_star bool,
  shadow_shundo bool,

  dynamax bool,
  dynamax_floor bool,
  dynamax_shiny bool,
  dynamax_four_star bool,
  dynamax_shundo bool,

  lucky_dynamax bool,
  lucky_dynamax_floor bool,
  lucky_dynamax_shiny bool,
  lucky_dynamax_four_star bool,
  lucky_dynamax_shundo bool,
  -- No shadow_dynamax combos anywhere — mutually exclusive in-game
  -- (confirmed). No shadow-mega either (confirmed) — shadow rows never
  -- get paired with mega_personal at all.

  best_shiny TEXT,               -- freeform user-entered value, e.g. "98%".
  best_non_shiny TEXT,           -- NOT derived from the booleans above —
  best_lucky TEXT                -- lets the user log "already have a 98%,
                                  -- not worth re-hunting" without that being
                                  -- a formal achievement tier of its own.

form_background_personal      -- junction: which backgrounds you own on
  form_slug FK,                -- which forms. Row existing = you own that
  background_slug FK,          -- form with that background. No legality
  PK (form_slug, background_slug)  -- table — every background is assumed
                                     -- possible on every form for now,
                                     -- known to be inaccurate but treated
                                     -- as acceptable simplification.

mega_personal
  mega_variant_slug FK/PK,
  evolved bool, shiny_evolved bool
```

## Reference data ingestion

- Ship a `reference.json` file as a bundled app asset (lives in this
  project's own git repo, versioned normally — no external host).
- I (the user) have a partial dataset already — likely a good chunk of
  species/forms but not guaranteed complete or fully detailed. Build the
  ingestion path to be tolerant of missing optional fields rather than
  assuming a complete dataset.
- On app start, if the bundled reference data's version is newer than what's
  stored, wipe and reload only the reference tables (upsert by slug),
  leaving personal tables untouched.
- Include a small "coverage report" dev tool/view — a way to see which
  species are missing key fields (types, region, availability flags) — since
  the dataset's completeness isn't fully known yet and will be filled in
  incrementally.

See `README.md` for the operational ingestion commands (`npm run ingest:*`)
and `INGESTION_PROGRESS.md` for pipeline status.
