# PoGo Buddy — Status

Living status doc. Update this whenever a task starts, finishes, or a new
one gets identified — don't let it go stale.

## Done

- Project scaffold: TypeScript + Vite, no framework (`package.json`,
  `vite.config.ts`, `tsconfig.json`).
- SQLite schema (`src/db/schema.ts` DDL, `src/db/types.ts` TS mirror)
  implementing CLAUDE.md's reference/personal table split, plus agreed
  additions: `form.gigantamax_available`, `form.shiny`/`lucky_shiny`/
  `shadow_shiny` (parity with `dynamax_shiny`), `app_settings` table,
  `form_background_personal.achievement_field` (a background can link to
  any specific tracked variant of a form, not just the form generically).
  Dropped `species.xxl_available`/`xxs_available` — XXL/XXS are always
  obtainable in-game, no availability gate needed.
- Dummy `.sqlite` generator (`npm run build:dummy-db`, uses Node's built-in
  `node:sqlite`) for external inspection in DB Browser for SQLite/`sqlite3`.
  Now loads the **real** ingested `reference.json`, not hand-written data.
- Repository abstraction (`src/data/repository.ts`) the UI codes against;
  `src/data/dummy-repository.ts` is an in-memory implementation (persisted
  to localStorage) satisfying the same interface the real
  capacitor-community/sqlite client will later.
- App shell: persistent header (search/hamburger), slide-in nav drawer
  (Pokedex, Stats, Search Tools, Coverage Report, Settings, plus muted
  future-phase Achievements/XP Assistant), hash-based router
  (`src/app-shell/`).
- Pokedex grid view: sprite tiles (real dex-numbered art), grayscale until
  caught, up to 4 configurable indicator badges, live name/dex filter,
  region-grouped collapsible sections, All/Caught/Uncaught filter chips.
- Species detail view: prev/next navigation, jump-to-species search,
  per-form toggle grid grouped by Standard/Lucky/Shadow/Dynamax/Lucky
  Dynamax.
- Settings page: indicator picker (capped at 4), gender-collapse-forms
  toggle.
- **Real reference data ingestion, full National Dex (1024 species, 2213
  forms, 44 mega variants, 9 regions)**: `scripts/ingest/` pipeline —
  `pokeapi-client.ts` (rate-limited at 45 req/min, on-disk cache, resumable),
  `fetch-pokeapi-data.ts` (walked all 1025 species + varieties, checkpointed
  to `INGESTION_PROGRESS.md`), `parse-forms-csv.ts` (the GO tracker CSV's
  species/region/form skeleton + availability, dash-convention), and
  `build-reference.ts` (joins PokeAPI types/gender/legendary-mythical/
  mega-kind onto the skeleton, emits `src/data/reference.json` +
  `src/data/reference-gaps.json`).
- CSV authoring tool (`scripts/ingest/csv-authoring.ts`): `export`/
  `template`/`import` modes, tested end-to-end including adding a new
  costume form via CSV import.
- Real Coverage Report page (`src/features/coverage-report/`), reading
  `reference-gaps.json`.
- Verified end-to-end with Playwright (chromium via
  `npx playwright install chromium`, not project-vendored) against the
  **full real dataset** — all 9 regions, grid filters, Unown's 29 forms,
  prev/next/jump-search, coverage report, settings cap — no console errors.
- **Unown's spurious "Standard" form fixed.** Its 28 letter forms (A–Z, !, ?)
  are the entire catchable set — the species header row isn't an independent
  29th "Standard" Unown. Fixed via a small `NO_STANDARD_FORM_NAMES` exception
  set in `scripts/ingest/pokemon-facts.ts` (consulted from
  `parse-forms-csv.ts`), not a generic parser rewrite. Unown now has exactly
  28 forms.
- **Bulbapedia Event Pokémon (GO) ingestion** — costumes were entirely
  unmodeled before this (zero forms had `costumeName` set, despite the schema
  supporting it). `scripts/ingest/parse-event-pokemon.ts` parses a raw
  wikitext snapshot of Bulbapedia's Event Pokémon page (committed at
  `scripts/ingest/sources/event-pokemon-go.wikitext`) into CSV rows merged
  through the existing `csv-authoring.ts import` workflow. Result: **601 new
  costume form rows across 123 species**. Fixed a real slug-collision bug
  found along the way: `formSlug()` didn't account for `costumeName`, so any
  costume on a species' base form would have collided with its plain
  "Standard" slug — extended (backward-compatibly) to include the costume
  when present.
- **Species detail page reworked for high-form-count species.** Pikachu alone
  has 188 forms post-costume-ingestion; the old always-expanded fieldset stack
  was unusable at that scale. Form groups are now collapsed-by-default
  `<details>` blocks, plus a compact overview grid at the top of the page
  (tinted per group when caught, click-to-expand-and-scroll-to that group).
  Verified via Playwright against Pikachu (188 forms) and Unown (28 forms).
- **Milestone B: Pokedex grid filter upgrade.** The grid's filter bar
  (`src/features/data-entry/species-grid.ts`) now promotes the user's chosen
  indicator fields (`getIndicatorSelection()`) into tri-state (off → include
  → exclude → off) filter chips alongside All/Caught/Uncaught, plus a "More
  filters" expansion covering every other achievement field and — per the
  user, since they're real tracked data but deliberately not one of the
  Settings-configurable badges — Legendary/Mythical/Ultra Beast and
  XXL/XXS/Purified (`RarityFilterField`/`SpeciesBooleanField` in
  `src/data/repository.ts`). Verified: Kanto's legendary filter narrows to
  exactly Articuno/Zapdos/Moltres/Mewtwo.
- **Milestone A: real persistent storage.** `src/data/sqlite-repository.ts`
  replaces the dummy backend as what `main.ts` actually uses — a genuine
  `@capacitor-community/sqlite` database via the `jeep-sqlite` web dev shim
  (sql.js + IndexedDB; no native Android project needed yet, see
  `src/db/sqlite-client.ts`'s header comment for why this isn't a
  browser-storage design change). Reads are served from an in-memory cache
  loaded once at boot (extracted the dummy backend's query/filter logic into
  `src/data/in-memory-store.ts` so both backends share it); writes go through
  to real SQLite. Also shipped, bundled into this milestone as agreed:
  - **Personal-schema migration runner** (`src/db/migrations.ts`) —
    versioned, currently empty (v1 is the fresh-install baseline) but ready
    for future schema changes.
  - **Slug-rename/alias mechanism** (`src/db/slug-renames.ts`,
    `src/db/reference-sync.ts`) — applies hand-registered slug renames to
    `form_personal`/`form_background_personal` before old reference rows get
    replaced, so a future display-name correction (like this session's
    Detective Pikachu one) can't silently orphan personal data. Registry is
    empty for now since nothing has shipped to a real device yet.
  - Reference-table refresh-on-change (content-hash versioned, per
    CLAUDE.md's "wipe and reload reference tables, leave personal alone"
    design) — `src/db/reference-sync.ts`.
  - Split `personal-demo-seed.ts`'s `defaultAppSettings` out into
    `db/defaults.ts`'s `DEFAULT_APP_SETTINGS` — real config defaults (e.g.
    which 3 badges show by default) a fresh SQLite install should get, unlike
    the fake demo *progress* (Bulbasaur caught, Charizard shiny, ...) which
    must never appear on a real install.
  - Verified end-to-end via Playwright: toggle a form as caught, **full page
    reload**, toggle survives (confirms real IndexedDB persistence, not just
    in-memory state); same for a Settings change. Re-ran the full existing
    regression set (Pikachu 188 forms, Unown 28, legendary filter, settings
    page, coverage report) against the new backend with zero console errors.
    Also verified `npm run build` + `vite preview` (production build, not
    just dev server).

## Real data-quality findings from ingestion (worth your attention)

The ingestion pass cross-checked your Forms tracker CSV against PokeAPI and
found several genuine errors in the CSV itself (all preserved as informed
choices, not silently "fixed" — see Coverage Report in-app):

- **Persian, Grimer, and Muk each have a bogus "Galarian" form row** — none
  of them have a real Galarian form in any game; PokeAPI confirms it. Looks
  like a copy-paste bleed from Meowth's/Weezing's real Galarian rows just
  above them in the spreadsheet.
- **Uxie, Mesprit, Azelf, Audino, Malamar, and Falinks are marked
  Mega-capable** in the tracker despite having no official Mega Evolution
  at all. No mega_variant row was generated for these; flagged instead.
- **Furfrou's "Pharoah" costume is listed twice** with conflicting Shiny
  availability — deduped (kept the Shiny-available copy), original
  duplicate flagged.
- Several real mega-availability gaps look genuinely stale rather than
  bogus: **Pidgeot, Kangaskhan, Mewtwo, Kyogre, Groudon** show a real
  PokeAPI mega but the tracker says unavailable — may just predate that
  mega's GO release; worth a manual check.
- Along the way, discovered **PokeAPI's own dataset includes a non-canonical
  fan-content pack ("Mega Dimension")** that fabricates "Mega" varieties
  for ~40 species with no official Mega Evolution (e.g. a fake "Mega
  Meganium" with a made-up ability) — filtered out by checking each
  candidate's `version_group` is `x-y` or `omega-ruby-alpha-sapphire`
  before trusting it.

## Bugs found and fixed this session (for reference)

- **Unown's "!" and "?" forms collided into one slug.** Both punctuation
  tokens stripped to an empty string during slugification, producing the
  identical `unown--unknown` slug for two different forms and crashing the
  `.sqlite` build with a UNIQUE constraint error. Fixed in
  `scripts/ingest/slug.ts` with an explicit translation map
  (`!`→"exclamation", `?`→"question") before slugifying.
- **Detail-view header overlapped content after navigating from a
  scrolled-down grid.** Since this is a single-page app, the browser kept
  its scroll position across route changes; the sticky header then covered
  the top of the shorter detail-view content. Fixed with
  `window.scrollTo(0, 0)` on every hash change in `src/main.ts`.
- **Forms CSV column parsing silently misread availability flags** (an
  early version treated Rattata as Mega/Dynamax/Gigantamax-capable, which
  is wrong) because the file pads cells with spaces for alignment and the
  parser wasn't trimming before comparing to `"-"`. Fixed in
  `scripts/ingest/parse-forms-csv.ts`'s `isAvailable()`.
- **`sql.js@1.14.1`'s wasm binary doesn't work with `jeep-sqlite`'s bundled
  glue JS** — app hung forever on "Loading your dex…" with a console error
  (`WebAssembly.instantiate(): ... function import requires a callable`).
  jeep-sqlite vendors compiled sql.js glue matching the ~1.11 line it was
  built against; a newer wasm binary doesn't match that ABI. Pinned
  `package.json`'s `sql.js` to exactly `1.11.0` (no caret — see
  `src/db/sqlite-client.ts`'s header comment). Don't bump sql.js without
  re-verifying the app still boots.

## Backlog (not started)

Agreed sequence as of 2026-07-01 (reasoning inline per item). Milestones A
and B are done (see Done section above) — C is next up.

### C. Stats / completion tracking

Now unblocked — real persistent storage (milestone A) removed the "is this
real data" doubt about building against dummy data. Per CLAUDE.md this is the
primary feature; the scope×lens query design is already spec'd there.
Concrete shape from the user (2026-07-01):

- Filters/selectables at the top; default view grouped by Region.
- Default lens: **Registered**, counted by **species**, not forms (e.g.
  "Kanto: 148 of 151" — not inflated by per-form/costume counts), shown with
  a progress bar/line and % complete.
- Lucky (and likely other achievement-column lenses) selectable the same way,
  also defaulting to a by-region breakdown.
- Ideally any tracked stat/lens is selectable, matching CLAUDE.md's
  parameterized scope×lens design (not one hardcoded view per region).
- **Open UX detail, not resolved yet**: the user wants form-complete/
  costume-complete and achievement-column lenses selectable via checkboxes,
  which reads as wanting to view multiple lenses at once rather than one
  radio-selected lens at a time — confirm with them directly when this
  milestone starts.

### D. Native Capacitor/Android scaffolding + APK packaging (deferred)

Only once A–C are proven against the web-shim backend does it make sense to
invest in `npx cap add android` and real device packaging — no point
scaffolding a native shell before the data layer and primary feature are
validated.

### Lower priority (unchanged from CLAUDE.md's own ranking)

- Search Tools (tri-state PoGo search-string builder) + the auto-declutter
  engine — CLAUDE.md explicitly ranks these below Stats.
- Background-linking UI (schema supports `form_background_personal`
  scoped per achievement variant; no picker UI built yet).
- Real GO cosmetic background data — none exists in any source yet; only
  2 hand-placed placeholders (`spring-2024`, `anniversary-2016`) exist so
  the schema has something to demonstrate against.
- The `001-Bulbasaur/Standard.md` question from the Obsidian refs — it
  looks like it might contain real personal progress data rather than
  just a structural example. Unresolved; ask before assuming either way.
- Bundle size: `reference.json` (now 1024 species/2813 forms after costume
  ingestion) is bundled directly into the JS chunk, past Vite's 500KB
  warning threshold — main JS chunk is now ~1.46MB (103KB gzipped) plus a
  separate ~300KB `jeep-sqlite.entry` chunk (84KB gzipped) after milestone A.
  Not a functional problem yet, but worth lazy-loading reference.json or
  fetching it as a separate asset instead of a static import before this goes
  much bigger. The jeep-sqlite chunk specifically will shrink or disappear
  once milestone D adds a native Android build (native SQLite doesn't need
  the sql.js/jeep-sqlite web shim at all).
- 282 forms have placeholder ("missing-types") typing — mostly costumes/
  letters/formes/less-common regional variants my PokeAPI variety-name
  guessing couldn't confidently match. Real values exist in PokeAPI: this
  needs a smarter matching pass (e.g. resolving via each variety's
  `pokemon-form` data) or manual correction via the CSV authoring tool.
- 27 costume names (Cosplay Pikachu variants, Pumpkaboo/Gourgeist sizes,
  T-shirt colors, etc.) fall back to a raw Bulbapedia sprite code since the
  source reuses one Form label across multiple rows for these — flagged to
  console by `parse-event-pokemon.ts`, not silently guessed. Worth a manual
  friendly-naming pass.

## Known issues / accepted tradeoffs

- ~~The per-form toggle grid on the species detail page requires a lot of
  scrolling per variant~~ — **resolved 2026-07-01**: form groups are now
  collapsed-by-default `<details>` blocks with a compact overview grid at
  the top of the page (see Done above).
- Gender availability (has_male/has_female) and legendary/mythical
  classification come from PokeAPI's `gender_rate`/`is_legendary`/
  `is_mythical` — trusted directly rather than double-checked by hand
  across all 1024 species. 65 genderless-and-standard-rarity species are
  flagged in the coverage report as worth a quick manual glance, not
  because they're likely wrong, just because genderless is the less common
  case.
- 385 forms carry availability (shadow/dynamax/gigantamax/evolves)
  inherited from their species rather than independently verified — this
  is a structural limitation of the source CSV (it only varies Shiny at
  the per-form level), not a bug; see memory
  `project_reference_data_ingestion.md`.
