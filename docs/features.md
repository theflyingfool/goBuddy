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

### 4. Sprite Pipeline
* **Matching**: Automated sprite matching script (`scripts/ingest/build-sprite-mapping.ts`) linking reference entries to extracted `PokeMiners/pogo_assets` icons.
* **Manual Overrides**: Key-value lookup dictionary (`scripts/ingest/costume-lookup.json`) maps complex event filenames to human-readable names.
* **Skins**: Shiny artwork view toggle on species-detail pages.

### 5. Data Safety Net
* **Boot Rescue**: Surfaces a safe raw-data export panel if the app crashes during boot or migration.
* **Orphan Quarantine**: Places orphaned personal rows into `personal_data_quarantine` if a reference sync deletes their corresponding reference slugs.
* **Write Failure Surfacing**: Swallowed database write errors trigger a persistent UI banner with retry options.
* **Downgrade Guard**: Boot fails gracefully with a downgrade blocker warning if the database version is newer than the app version.

---

## Future Roadmap Checklist

The master checklist for planned features, organized by functional area.

### Progression & Stat Trackers
- [ ] **Multi-Account & Sharing**: Allow importing databases from friends to show completion comparisons and trade gap analysis.
- [ ] **Level Tracker**: Track total XP progression to level 80 and display required level-up tasks.
- [ ] **Medal Tracker**: Medal progress metrics, checklists, and strategic advice for unlocking achievements.
- [ ] **Best Buddy Tracker**: Track buddy status, ribbon achievements, and active CP level boosts.
- [ ] **Buddy Heart Daily Tracker**: Log daily buddy points (play, feed, snapshot, battle, walk) with calculators estimating days remaining to Best Buddy.

### Battle & PvP Reference Tools
- [ ] **PVP/PVE Team Builder**: Simulator for building optimized PVP/PVE team compositions based on movesets, type matchups, and IV stats.
- [ ] **PVP Stat Product / Rank Calculator**: Offline rank calculator taking a species and IV spread to calculate exact stat product and PvP rank (1–4096) for Great and Ultra Leagues.
- [ ] **Type Effectiveness Matrix**: Offline quick-reference battle helper for checking weaknesses, resistances, and immunities.
- [ ] **Raid Counter Simulator**: Select a raid boss and show the top offline-recommended counter species and optimal movesets.

### Capture & Encounter Utilities
- [ ] **Wild 100% IV CP Lookup**: Offline tables showing exact CP values signaling a potential wild 100% IV encounter for levels 1–35 (standard & weather-boosted).
- [ ] **Wild CP OCR Assistant**: Fully offline client-side OCR (e.g. Tesseract.js) parsing wild encounter screenshots to instantly flag matching possible 100% IV CPs.
- [ ] **Raid Boss 4★ CPs**: Display maximum CP thresholds for perfect-IV (4★) Raid boss encounters to simplify capture checks.
- [ ] **Catch Rate Calculator**: Input species, ball type, throw quality, berry, and medal tiers to calculate the exact catch percentage.
- [ ] **Shadow Purification Calculator**: Predicts if a shadow Pokémon's IVs will result in a perfect 100% (4★) IV upon purification (+2 to all stats).

### Collection & Data Helpers
- [ ] **Caught Notes**: Ability to attach custom notes/stamps to individual caught forms (e.g., date caught, trade origin, location).
- [ ] **Evolution Candy Calculator**: Local resource planner estimating total candies, candy XLs, and special items required to complete living-dex evolutions.
- [ ] **Egg Hatch Checklist**: Track current egg pool reference lists (2km, 5km, 7km, 10km, 12km) and tick off hatch-only achievements.
- [ ] **Manual Search Builder**: Tri-state toggle UI (off → include → exclude) generating valid GO search strings with `&`/`,`/`!` operators.
- [ ] **Auto-Declutter Engine**: SQL-based reduction engine generating a single grouped transfer query (e.g. `1,3,25&!4*&1*,2*,3*`).
- [ ] **Background Legality**: Track form-specific background legality instead of assuming every background is legal on every form.
- [ ] **Coverage Report Persistence**: Save gap-reviewed state via `coverage_reviewed` settings flags.
- [ ] **Bulk Edit Pagination**: Introduce pagination controls or an adjustable display cap setting to optimize rendering speed.
- [ ] **Page-Mode Consolidation**: Collapse Dex Grid and Bulk Edit into a single route, using a toggled "Browse vs Edit" layout mode.
- [ ] **UI Tile Unification**: Refactor Dex `.species-tile` and Bulk Edit/Detail `.form-tile` into a shared component.
