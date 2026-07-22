# Shipped Features (PoGo Buddy)

This is the canonical shipped-feature summary for the PoGo Buddy Pokémon GO Companion, mapping all active capabilities currently built into the app.

---

## 1. Completion & Progress Stats

A general-purpose stats engine (`src/data/completion-stats-sql.ts`) backing the in-app KPI charts and regions dashboards.

* **Scope**: Evaluates progress at Regional level, Species drill-down, or global/all-dex scale.
* **Lenses**:
  * *Registered*: At least one form of the species is caught.
  * *Form-complete*: Every non-costume form/gender caught.
  * *Costume-complete*: Every released costume owned.
  * *Achievement-complete*: Checks specialized personal criteria (Shiny, Lucky, Shadow, Purified, etc.).
  * *Mega/G-Max*: Evolved all forms/variants for species matching those descriptors.

## 2. Mega Evolution & Gigantamax

* **Mega Evolution**: Modeled species-wide (`mega_personal`, keyed by `mega_variant.slug`). Supports X/Y/Primal variants. Checking Shiny Evolved cascades forward to auto-check Evolved.
* **Gigantamax**: Modeled as ordinary form rows in the main database, carrying standard caught/shiny achievements.

## 3. Data Entry & Search

* **Checklist Grids**: Mobile-optimized bottom tab bar navigation and desktop persistent sidebar navigation. Includes species form search, caught filters, and a "Missing only" toggle.
* **Write Cascades**: Checking a combined tier (e.g. Shundo) auto-checks logical pre-requisites (Shiny, 4★, Caught, Registered). Unchecking does not cascade.
* **Search Engine**: Fuzzy matching (handles typos like "pikchu"), exact dex number matching, and special keywords (`costume`, `legendary`, `mythical`, `ultrabeast`, negated with `!`).

## 4. Sprite Pipeline

* **Sourcing**: `scripts/ingest/fetch-sprites.ts` downloads every sprite `pokemon-go-api` links from its pokedex data (species, region forms, costumes, mega/Gigantamax, both regular and shiny).
* **Promotion**: `scripts/ingest/build-sprites.ts` converts each cached original to WebP into `public/sprites/`, keyed by our own species/form/mega slugs — the only thing that writes to that folder.
* **Skins**: Shiny artwork view toggle on species-detail pages.

## 5. Data Safety Net

* **Boot Rescue**: Surfaces a safe raw-data export panel if the app crashes during boot or migration.
* **Orphan Quarantine**: Places orphaned personal rows into `personal_data_quarantine` if a reference sync deletes their corresponding reference slugs.
* **Write Failure Surfacing**: Swallowed database write errors trigger a persistent UI banner with retry options.
* **Downgrade Guard**: Boot fails gracefully with a downgrade blocker warning if the database version is newer than the app version.

---

## Future Work

See [docs/roadmap.md](roadmap.md) for planned features, the V2 watchlist, and known open polish items.
