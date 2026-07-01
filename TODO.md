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
- **Milestone C: Stats / completion tracking.** CLAUDE.md's primary feature.
  `src/data/repository.ts` adds `CompletionScope`/`CompletionLens`/
  `getCompletionStats()` — one parameterized query per lens *kind*
  (Registered, Form-complete, Costume-complete, Achievement-by-column),
  taking scope (region/species/global) as a parameter, not hand-rolled
  queries per region or per achievement column. Two implementations, per the
  established split: `src/data/completion-stats-sql.ts` is real parameterized
  SQL against the SQLite connection (what the app actually runs, per
  CLAUDE.md's explicit ask); `src/data/in-memory-store.ts` has an equivalent
  computed in plain JS for the dummy-backend fallback. `sqlite-repository.ts`
  flushes its pending write queue before querying so a stat computed right
  after a toggle can't read a stale connection.
  - UI (`src/features/stats/stats-page.ts`): region-grouped table, one column
    per **checked** lens (multi-select checkboxes, per the user — not a
    single-select picker), plus an "All regions" summary row. Each cell shows
    a mini progress bar + `complete/total (pct%)`; clicking one shows a
    missing-species drill-down below the table. Registered/Form-complete/
    Costume-complete stay always visible; the 24 achievement-column lenses
    (Shiny, Lucky, Shundo, ...) collapse under a "More lenses" `<details>` by
    default (auto-opens if one inside is checked) — same
    collapsed-by-default language as the grid's "More filters" and the forms
    page, now that a flat 27-checkbox list was confirmed too tall on mobile.
  - Default checked lenses: Registered + Lucky, per the user's own example.
  - Real modeling decision made here, not explicit in CLAUDE.md: Costume-
    complete's denominator only counts species that actually have ≥1 costume
    form — otherwise the ~900 species with zero costumes would count as
    trivially "complete" and inflate the stat into something meaningless.
  - Verified via Playwright: toggled Bulbasaur's Registered + Standard
    Caught + Lucky, confirmed Kanto shows 1/151 for both Registered and Lucky
    columns, and the missing-species drill-down correctly excludes Bulbasaur.
    Full regression pass across every route (grid, detail, stats, coverage
    report, settings, stubs) — zero console errors. Production build verified.
- **Milestone D: native Capacitor/Android scaffolding.** `capacitor.config.ts`
  (appId `com.theflyingfool.pogobuddy` — a placeholder reverse-domain string,
  fine since this never publishes to the Play Store; **change it now if you
  want your own convention**, since it becomes the Java package structure and
  is annoying to rename later) + `npx cap add android` generated the
  `android/` native project, auto-detecting and linking
  `@capacitor-community/sqlite`. Made `src/db/sqlite-client.ts`
  platform-aware (`Capacitor.getPlatform() === "web"` guards) — it was
  unconditionally bootstrapping the Web-only jeep-sqlite shim before; native
  Android talks to real on-device SQLite directly and must skip that
  entirely. Verified for real, not just "files got scaffolded": built the
  actual debug APK end-to-end (`./gradlew assembleDebug`, 37.7MB
  `app-debug.apk`) — required pointing `JAVA_HOME` at Android Studio's
  bundled JBR (`/opt/android-studio/jbr`, JDK 21) since Gradle 8.14 can't run
  on this machine's default JDK 26 ("Unsupported class file major version
  70"); rebuilt after the platform-aware fix to confirm it's actually in the
  shipped build, not just compiled once before the fix existed.
  - **Not yet done**: never installed/run on a real device or emulator — no
    AVD exists yet and no physical device was attached this session. Building
    the debug APK is real proof the native project is wired correctly, but
    isn't the same as confirming SQLite/jeep-sqlite-vs-native behavior on an
    actual Android runtime. Worth doing before trusting this fully.
  - App icon and splash screen are Capacitor's **generic default placeholders**
    (the default Capacitor logo/blank splash) — not customized to GoBuddy at
    all. Cosmetic, but worth fixing before this ever gets installed somewhere
    you'd actually look at it.
  - **Correction to an earlier prediction**: the bundle-size backlog note
    below previously said the jeep-sqlite chunk "will shrink or disappear
    once milestone D adds a native build" — that was wrong. Capacitor ships
    one universal web bundle to both platforms; the platform-aware guard
    means jeep-sqlite/sql.js code won't *run* on native, but it's still
    *bundled* into the APK's web assets. Actually shrinking the native build
    would need real code-splitting (dynamic `import()` gated on
    `Capacitor.getPlatform()`), not just adding the native project.

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
- **Coverage Report was stale, not factually wrong.** Verified: nothing in
  `coverage-report-page.ts` or `reference-gaps.json` was hardcoded (checked
  for orphaned slug references, hardcoded counts, everything traced back to
  real ingestion output) — but `reference-gaps.json` is only written by
  `npm run ingest:build` (the Forms-CSV/PokeAPI pipeline). The costume CSV
  import (`csv-authoring.ts import`) never touched it, so the report reflected
  a snapshot from *before* the 601 Bulbapedia costume forms existed, and the
  23 "guessed a costume name from a raw sprite code" cases
  (`parse-event-pokemon.ts` flagged these, see the Bulbapedia ingestion entry
  above) were only ever visible in that script's console output — never in
  the actual in-app Coverage Report a user would check. Fixed: added a new
  `ReferenceGap` kind (`guessed-costume-name`), `parse-event-pokemon.ts` now
  merges these into `reference-gaps.json` itself (replacing only its own
  kind, so `ingest:build`'s Forms-CSV gaps survive), and re-ran the full
  pipeline (`ingest:build` → `ingest:events` → `ingest:csv:import`) in the
  correct order to bring both files back in sync. Verified in-app: "Guessed
  costume name (23)" now shows up in Coverage Report.
  - **Standing gap, not fully closed**: this pipeline is still not a single
    atomic step — anyone adding data through `csv-authoring.ts import`
    directly (not through `parse-event-pokemon.ts`) still won't get any gap
    checking at all. Worth revisiting if manual CSV authoring becomes more
    frequent than the costume-ingestion case that prompted this fix.

## Backlog (not started)

Agreed sequence as of 2026-07-01 (reasoning inline per item). Milestones A, B,
C, and D are all done (see Done section above) — nothing next-in-sequence has
been agreed yet; the two items below were reported directly by the user
during D and are the most concrete known next work.

### Install/run the real APK on a device or emulator

Milestone D only verified `./gradlew assembleDebug` succeeds — never actually
installed or ran the app on a real Android runtime (no AVD, no physical
device attached this session). Worth doing before trusting the native
SQLite/jeep-sqlite platform split is actually correct in practice, not just
in code review.

### Custom app icon + splash screen

Currently Capacitor's generic default placeholders from `cap add android`.
Cosmetic, but should get a real GoBuddy icon before this is something you'd
actually want installed and looked at on your phone.

### Pokedex grid: filter by reference availability (Dynamax/Gigantamax/Mega), not just personal achievement

User-reported 2026-07-01: tried to filter the grid for "uncaught species that
*can* be Dynamaxed" using Uncaught + the green "Dynamax" chip, and it didn't
work. Root cause: the grid's field filters (`GridFilterField` in
`src/data/repository.ts`) only expose **personal achievement** fields
(`form_personal.dynamax` — "have I already caught a Dynamax individual of
this") and rarity (`legendary`/`mythical`/`ultraBeast`, derived from
`species.rarity`). There's no filter at all for **reference availability**
(`form.dynamaxAvailable`/`gigantamaxAvailable`/`species.canMegaEvolve` — "can
this species/form ever be Dynamaxed/Mega-evolved in-game"). Combining
Uncaught with the existing "Dynamax" chip is close to a logical
impossibility — a species you haven't caught can't have any personal
achievement flag true — which is exactly why it produced nothing useful.

Also flagged: **there's no personal `gigantamax` achievement field at all** —
CLAUDE.md's original schema only gave the Dynamax branch (and its
lucky/shiny/floor/4★/shundo variants) a `form_personal` column; Gigantamax
was never given its own. Not a bug in this session's code — just confirms
there's currently no way to track "have I gotten a Gigantamax individual" as
a distinct fact, separate from a regular Dynamax catch. Worth asking the user
whether that's intentional or a schema gap to close.

Per the user, the fix isn't just "add more checkboxes to the same list" —
they expect Caught/Uncaught to stay the primary/orthogonal filter, with
Dynamax/Legendary/Ultra Beast/Mythical/Gigantamax/Mega-capable grouped
together as their *own* filter dimension (closer to how CLAUDE.md's Feature 2
tri-state search-string builder already treats these same categories) rather
than mixed into the same tri-state chip list as personal achievement fields
like Shiny/Lucky/Shundo. Needs a design pass, not just a data-layer add.

### Stats page: region drill-down + clickable species

User-requested 2026-07-01: clicking a **region** (not just a specific
lens cell) should expand to show the full per-species detail for that region
(right now only clicking a lens *cell* shows a missing-species list for that
one lens — there's no "show me everything for this region" view). And within
that expanded view, clicking an individual species should navigate straight
to that species' Pokedex detail page (`speciesDetailPath`) — right now the
missing-species list in `stats-page.ts` is plain text, not links.

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
  warning threshold — main JS chunk is now ~1.48MB (106KB gzipped) plus a
  separate ~300KB `jeep-sqlite.entry` chunk (84KB gzipped). Not a functional
  problem yet, but worth lazy-loading reference.json or fetching it as a
  separate asset instead of a static import before this goes much bigger.
  **Correcting an earlier prediction here**: milestone D's native Android
  build does *not* shrink the jeep-sqlite chunk — Capacitor ships one
  universal web bundle to every platform, so that code is still bundled into
  the APK even though `sqlite-client.ts` now skips *running* it on native.
  Actually dropping it from the native build would need real code-splitting
  (`import()` gated on `Capacitor.getPlatform()`), not just adding the
  native project.
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
