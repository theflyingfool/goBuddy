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

## Backlog (not started)

- Features 1–3 from CLAUDE.md: completion/progress stats, the merged
  search-string-builder + auto-declutter "Search Tools" page, and their
  underlying parameterized scope/lens SQL queries.
- Real on-device storage: wiring capacitor-community/sqlite +
  jeep-sqlite (web dev shim) as the actual runtime backend, replacing the
  in-memory dummy repository. Capacitor/Android project scaffolding
  (`npx cap add android`) hasn't been done yet at all.
- Personal-schema migration runner (schema_version-driven).
- Background-linking UI (schema supports `form_background_personal`
  scoped per achievement variant; no picker UI built yet).
- Real GO cosmetic background data — none exists in any source yet; only
  2 hand-placed placeholders (`spring-2024`, `anniversary-2016`) exist so
  the schema has something to demonstrate against.
- The `001-Bulbasaur/Standard.md` question from the Obsidian refs — it
  looks like it might contain real personal progress data rather than
  just a structural example. Unresolved; ask before assuming either way.
- Bundle size: `reference.json` (1024 species/2213 forms) is now bundled
  directly into the JS chunk (~977KB), past Vite's 500KB warning
  threshold. Not a functional problem yet, but worth lazy-loading or
  fetching as a separate asset instead of a static import before this
  goes much bigger.
- 282 forms have placeholder ("missing-types") typing — mostly costumes/
  letters/formes/less-common regional variants my PokeAPI variety-name
  guessing couldn't confidently match. Real values exist in PokeAPI: this
  needs a smarter matching pass (e.g. resolving via each variety's
  `pokemon-form` data) or manual correction via the CSV authoring tool.

## Known issues / accepted tradeoffs

- The per-form toggle grid on the species detail page requires a lot of
  scrolling per variant (Standard/Lucky/Shadow/Dynamax/Lucky Dynamax ×
  each gender). User flagged this as "kind of a pain" but OK for now —
  worth revisiting (e.g. tabs per branch, collapsible sections) now that
  the real dataset makes the pain concrete (Furfrou alone has 11 costumes
  × 2 genders = 22 form groups).
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
