# Features Spec & Future Roadmap

This document serves as the canonical home for all active and planned features of the GoBuddy Pokémon GO Companion.

---

## Shipped Features (Current Version)

### 1. Completion & Progress Stats
A general-purpose stats engine (`src/data/completion-stats-sql.ts`) backing the in-app KPI charts and regions dashboards.
* **Scope**: Evaluates progress at Regional level, Species drill-down, or global/all-dex scale.
* **Lenses**:
  * *Registered*: At least one form of the species is caught.
  * *Form-complete*: Every non-costume form/gender caught.
  * *Costume-complete*: Every released costume owned.
  * *Achievement-complete*: Checks specialized personal criteria (Shiny, Lucky, Shadow, Purified, etc.).
  * *Mega/G-Max*: Evolved all forms/variants for species matching those descriptors.

### 2. Mega Evolution & Gigantamax
* **Mega Evolution**: Modeled species-wide (`mega_personal`, keyed by `mega_variant.slug`). Supports X/Y/Primal variants. Checking Shiny Evolved cascades forward to auto-check Evolved.
* **Gigantamax**: Modeled as ordinary form rows in the main database, carrying standard caught/shiny achievements.

### 3. Data Entry & Search
* **Checklist Grids**: Mobile-optimized bottom tab bar navigation and desktop persistent sidebar navigation. Includes species form search, caught filters, and a "Missing only" toggle.
* **Write Cascades**: Checking a combined tier (e.g. Shundo) auto-checks logical pre-requisites (Shiny, 4★, Caught, Registered). Unchecking does not cascade.
* **Search Engine**: Fuzzy matching (handles typos like "pikchu"), exact dex number matching, and special keywords (`costume`, `legendary`, `mythical`, `ultrabeast`, negated with `!`).

### 4. Sprite Asset Pipeline
* **Matching**: Automated sprite matching script (`scripts/ingest/build-sprite-mapping.ts`) linking reference entries to extracted `PokeMiners/pogo_assets` icons.
* **Manual Overrides**: Key-value lookup dictionary (`scripts/ingest/costume-lookup.json`) maps complex event filenames to human-readable names.
* **Skins**: Shiny artwork view toggle on species-detail pages.

### 5. Data Safety Net
* **Boot Rescue**: Surfaces a safe raw-data export panel if the app crashes during boot or migration.
* **Orphan Quarantine**: Places orphaned personal rows into `personal_data_quarantine` if a reference sync deletes their corresponding reference slugs.
* **Write Failure Surfacing**: Swallowed database write errors trigger a persistent UI banner with retry options.
* **Downgrade Guard**: Boot fails gracefully with a downgrade blocker warning if the database version is newer than the app version.

---

## Planned & Deferred Features

The following features are deferred to future releases (post-v1.0.0).

| Feature / Area | Status | Design & Technical Requirements |
| :--- | :--- | :--- |
| **Level Tracker** | [ ] | Track total XP to level 80 and display required leveling tasks. |
| **Medal Tracker** | [ ] | Track medals progress and offer strategic advice for unlocking achievements. |
| **Trade Analyzer** | [ ] | Fair trade logic evaluating species rarity, trade cost, and IV probabilities. |
| **PVP/PVE Team Builder** | [ ] | Team composition simulator based on movesets, matchups, and IV stats. |
| **Manual Search Builder** | [ ] | Tri-state toggle UI (off → include → exclude) generating valid GO search strings with `&`/`,`/`!` operators. Includes safety clauses to protect shiny/lucky/costume. |
| **Auto-Declutter Engine** | [ ] | SQL-based reduction engine generating a single grouped transfer query (e.g. `1,3,25&!4*&1*,2*,3*`). Must exclude `favorite` and `specialbackground` by default. |
| **Coverage Report Persistence** | [ ] | Save gap reviewed state via `coverage_reviewed:{kind}:{key}` flags stored in the stable `app_settings` KV table, surviving reference syncs. |
| **Bulk Edit Pagination** | [ ] | Introduce pagination controls or an adjustable display cap setting (e.g., 120/250/unlimited) to optimize rendering speed. |
| **UI Tile Unification** | [ ] | Refactor Dex `.species-tile` and Bulk Edit/Detail `.form-tile` into a shared component to simplify styling overrides. |
| **Page-Mode Consolidation** | [ ] | Collapse Dex Grid and Bulk Edit into a single route, using a toggled "Browse vs Edit" layout mode. |
| **Background Legality** | [ ] | Track form-specific background legality instead of assuming every background is legal on every form. |
