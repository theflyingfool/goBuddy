# Future Roadmap (PoGo Buddy)

This is the canonical future roadmap for PoGo Buddy: planned features, enhancement checklists, target versions, the V2 watchlist, open polish items, and items still awaiting an owner decision.

---

## 1. Master Roadmap Checklist

A high-density list of planned features grouped by functional area.

### Progression & Stat Trackers
- [ ] **Multi-Account & Sharing**: Allow importing databases from friends to show completion comparisons and trade gap analysis.
- [ ] **Level Tracker**: Track total XP progression to level 80 and display required level-up tasks.
- [ ] **Medal Tracker**: Medal progress metrics, checklists, and strategic advice for unlocking achievements.
- [ ] **Best Buddy Tracker**: Track buddy status, ribbon achievements, and active CP level boosts.
- [ ] **Buddy Heart Daily Tracker**: Log daily buddy points (play, feed, snapshot, battle, walk) with calculators estimating days remaining to Best Buddy.
- [ ] **Routes & Zygarde Cell Tracker**: Track Route completions and daily Zygarde Cell progression toward 50% and 100% Zygarde Formes.
- [ ] **Gym Badge Tracker**: Track personal Gym badges (Bronze, Silver, Gold) with custom name and location markers.

### Battle & PvP Reference Tools
- [ ] **PVP/PVE Team Builder**: Simulator for building optimized team compositions based on movesets, type matchups, and IV stats.
- [ ] **PVP Stat Product / Rank Calculator**: Offline rank calculator taking a species and IV spread to calculate exact stat product and PvP rank (1–4096) for Great/Ultra Leagues.
- [ ] **Type Effectiveness Matrix**: Offline quick-reference battle helper for checking weaknesses, resistances, and immunities.
- [ ] **Raid Counter Simulator**: Select a raid boss and show the top offline-recommended counter species and optimal movesets.

### Capture & Encounter Utilities
- [ ] **Wild 100% IV CP Lookup**: Offline tables showing exact CP values signaling a potential wild 100% IV encounter for levels 1–35 (standard & weather-boosted).
- [ ] **Wild CP OCR Assistant**: Fully offline client-side OCR (e.g. Tesseract.js) parsing wild encounter screenshots to instantly flag matching possible 100% IV CPs.
- [ ] **Raid Boss 4★ CPs**: Display maximum CP thresholds for perfect-IV (4★) Raid boss encounters to simplify capture checks.
- [ ] **Showcase Score Calculator**: Calculate estimated showcase points (0-1000) for weight, height, and IV combinations to identify top showcase contenders.
- [ ] **Catch Rate Calculator**: Input species, ball type, throw quality, berry, and medal tiers to calculate the exact catch percentage.
- [ ] **Shadow Purification Calculator**: Predicts if a shadow Pokémon's IVs will result in a perfect 100% (4★) IV upon purification (+2 to all stats).

### Collection & Data Helpers
- [ ] **Caught Notes**: Ability to attach custom notes/stamps to individual caught forms (e.g., date caught, trade origin, location).
- [ ] **Trade Board Registry (LF/FT)**: Local trade board logging duplicate shinies/costumes "For Trade" (FT) and missing dex requirements "Looking For" (LF).
- [ ] **Evolution Candy Calculator**: Local resource planner estimating total candies, candy XLs, and special items required to complete living-dex evolutions.
- [ ] **Egg Hatch Checklist**: Track current egg pool reference lists (2km, 5km, 7km, 10km, 12km) and tick off hatch-only achievements.
- [ ] **Manual Search Builder**: Tri-state toggle UI (off → include → exclude) generating valid GO search strings with `&`/`,`/`!` operators.
- [ ] **Auto-Declutter Engine**: SQL-based reduction engine generating a single grouped transfer query (e.g. `1,3,25&!4*&1*,2*,3*`).
- [ ] **Background Legality**: Track form-specific background legality instead of assuming every background is legal on every form.
- [ ] **Coverage Report Persistence**: Save gap-reviewed state via `coverage_reviewed` settings flags.
- [ ] **Bulk Edit Pagination**: Introduce pagination controls or an adjustable display cap setting to optimize rendering speed.
- [ ] **Page-Mode Consolidation**: Collapse Dex Grid and Bulk Edit into a single route, using a toggled "Browse vs Edit" layout mode.
- [ ] **UI Tile Unification**: Refactor Dex `.species-tile` and Bulk Edit/Detail `.form-tile` into a shared component.

---

## 2. Detailed Roadmap Table

Use this table during development to track progress status, notes, and target version releases.

| Feature Name | Target Version | Status | Development & Versioning Notes |
| :--- | :---: | :---: | :--- |
| **Multi-Account & Sharing** | `v1.1.0` | Planned | Compare local database vs imported JSON dump from a friend to highlight trade gaps. |
| **Caught Notes** | `v1.1.0` | Planned | Store notes inside a new `personal_notes` table keyed by form slug. |
| **Raid Boss 4★ CPs** | `v1.1.0` | Planned | Reference dataset mapping raid boss species to their perfect CP encounters at level 20 (and level 25 weather boosted). |
| **Showcase Score Calculator** | `v1.1.0` | Planned | Local math helper taking species, height, weight, and IV stats to compute local showcase score. |
| **Shadow Purification** | `v1.1.0` | Planned | Quick UI lookup to see if shadow IV stats are >= 13/13/13 (resulting in 15/15/15 when purified). |
| **Evolution Resource Calc** | `v1.2.0` | Planned | Candy/Item calculator to estimate the resources needed to finish regional dex evolutions. |
| **Type Matchup Matrix** | `v1.2.0` | Planned | Simple grid interface mapping offense/defense multipliers on species view pages. |
| **Best Buddy Tracker** | `v1.2.0` | Planned | Checkboxes tracking best buddy ribbons and daily buddy activity logs. |
| **PVP/PVE Team Builder** | `v2.0.0` | Planned | Simulation engine calculating type matchup coverages and ideal movesets. |
| **PVP Rank Calculator** | `v2.0.0` | Planned | Offline stat-product calculator matching custom IVs against the optimal PvP level stats. |
| **Wild 100% IV Lookup** | `v2.0.0` | Planned | Wild encounter CP guide for perfect stats at levels 1 to 35. |
| **Wild CP OCR Assistant** | `v2.0.0` | Planned | OCR tool scanning overlay captures to parse CP values offline. |
| **Trade Board LF/FT** | `TBD` | Planned | Interface to export a small "trade checklist" text sheet to share with local communities. |
| **Zygarde / Routes Tracker** | `TBD` | Planned | Progress checklist showing route completions and Zygarde Cell counts. |
| **Gym Badge Tracker** | `TBD` | Planned | Basic local list of visited gyms and badge tiers. |

---

## 3. V2 Watchlist (Deferred, With Rationale)

These items were deliberately pushed past V1, each for a specific reason —
not just "later." Recovered from the pre-restructure `docs/v1-tasks/09-v2-watchlist.md`
and `docs/data-model.md`'s "Future direction" section (git history at
`f7cb308^`).

- **Identity/slug rework**: Move the stable identity key for species/forms/costumes
  off the current cosmetic `slug` column and onto something durable — most likely
  Niantic's own game-master form/costume ID enum — with `slug` demoted to a
  purely display-only column. Deferred because it's entangled with the
  image-pipeline's numeric-ID matching work and would force a migration of
  every downstream reference (sprite manifests, exports, costume-lookup
  overrides); doing it now would block other in-flight V1 work rather than
  simplify it.
- **Reference/personal database file split**: Split the single SQLite file
  into two physical files — one for bundled reference data, one for personal
  collection data. Deferred alongside the slug rework since both are the same
  "heavier DB rework" the owner is planning post-V1; bundling them together
  is less total churn than doing either alone first.
- **Purified-form branch**: A dedicated purified-lucky/purified-shiny/purified-hundo
  branch of achievement tracking, distinct from the existing Shadow/Purified
  boolean. Not scoped or schema-designed yet.
- **`paradox` rarity classification**: A new rarity bucket for Paradox
  Pokémon, alongside the existing legendary/mythical/ultrabeast keywords and
  chips. Deferred as an extension of the same rarity-taxonomy work, not
  urgent for V1's dex-tracking scope.
- **Mega level column**: A `Base`/`High`/`Max` mega-level column is not yet
  modeled anywhere in the schema. Deferred pending real in-game data on how
  mega levels should factor into completion lenses.
- **Z-A megas ingestion-filter update**: `build-reference.ts`'s mega-variant
  filter needs a follow-up pass once *Legends: Z-A*'s new Mega Evolutions
  actually ship in GO (they're official DLC content, not fan content — see
  the ingestion pipeline notes) so they get picked up rather than filtered
  out by the current mainline-`version_group` matching rule.
- **Reference/informational content beyond dex-tracking**: per the owner,
  a much larger tier of static game-reference content is wanted eventually —
  Mega/Gigantamax candy cost per species (note: this isn't a separate
  currency — Mega/Gigantamax leveling uses the same candy/candy XL as any
  other form, so this is really "how much of that shared resource does this
  species' Mega/G-max form need," not a new cost type), Pokédex flavor text
  (species descriptions), CP at max level, full learnable-moveset lists
  (fast + charged, per species/form), and an XP-optimization guide for
  reaching level 80 efficiently. None of this is personal per-catch data,
  so per CLAUDE.md's data-ownership principles it belongs in its own
  reference-ingestion-fed table(s)/feature area rather than bolted onto
  `species`/`form`. Route candy-cost/CP/movesets/dex-text through the same
  ingestion pipeline ([docs/ingestion-runbook.md](ingestion-runbook.md)) once
  a data source is picked. The XP-optimization piece is related to this
  document's existing **Level Tracker** checklist item above but is a
  distinct feature (progression tracking vs. an efficiency guide) — keep
  both as separate roadmap items, not a merge candidate.
- **Other identified-but-unscoped V2 items**, kept here so they aren't
  silently dropped: full adoption of `executeSet`/`importFromJson`/`copyFromAssets`
  for bulk writes (a V1 contingency that was evaluated and explicitly not
  pulled forward — see CHANGELOG); a manual verification pass over roughly
  65 unverified-genderless species and 385 inherited-availability forms
  currently riding as Coverage-Report-flagged caveats (deferred because it
  makes more sense folded into the DB rework above than done standalone);
  Coverage Report review-state persistence so a reviewed gap stays reviewed
  across `ingest:build` re-runs; the tri-state Manual Search Builder and
  Auto-Declutter Engine already listed above in the Master Roadmap Checklist
  (their safety-clause spec work — protecting shiny/lucky/costume/legendary
  from accidental transfer, and excluding `favorite`/`specialbackground` by
  default — is already written up; the multi-rule priority order is still
  undecided); and a dark-mode manual toggle plus a dedicated ≥768px desktop
  breakpoint, if not already finished as part of ongoing legibility work.

---

## 4. Open Polish Items (Not Blocking V1 Tag)

Known rough edges, not release blockers. Recovered from the pre-restructure
`docs/v1-tasks/03-visual-and-legibility.md`, `05-image-pipeline.md`, and
`07-documentation-and-release.md`.

- **Species-detail perf**: toggling a field on the species-detail page still
  triggers a full-page rerender of the entire form-tile grid
  (`src/features/data-entry/species-detail.ts`). Should rebuild only the
  toggled tile in place instead.
- **Search-quality bugs** (four distinct issues, all in the search path):
  - Dex-number search is unanchored substring matching rather than
    prefix/exact — typing `25` to jump to #25 Pikachu also matches #125,
    #225, #250–259, #325, #425, etc. Affects the grid, Bulk Edit, and the
    header's species-detail "jump to" box
    (`String(species.dexNumber).includes(q)` in `src/data/in-memory-store.ts`).
  - No apostrophe/punctuation normalization anywhere in the search path:
    `reference.json` stores Farfetch'd/Sirfetch'd with a curly quote
    (U+2019), so typing the ordinary keyboard apostrophe never matches;
    `Mr. Mime`/`Mr. Rime`/`Type: Null` require typing the exact
    period/colon.
  - The `legendary`/`mythical`/`ultrabeast` search keywords duplicate the
    existing classification filter chips exactly and compose by AND with
    them — typing `legendary` while the L chip is set to Exclude silently
    produces zero results with no indication why.
  - The header's "jump to species" search box (species-detail route only,
    `src/app-shell/header.ts`) isn't debounced (unlike the grid's filter
    input in the same file), has no "no matches" empty state, and no
    truncation indicator past its 8-result cap.
- **`form.imageRef` cross-referencing**: the reserved `form.imageRef` column
  is still not wired up into `build-reference.ts`'s ingestion output — the
  sprite-slug manifest (`src/data/form-sprite-slugs.json`) currently serves
  the same "does this form have art" purpose without needing it. Revisit
  once `costume-lookup.json` has more real entries and the extra-images
  backlog shrinks.
- **`docs/data-model.md` DDL-vs-`schema.ts` divergence**: the documented DDL
  has drifted from the actual `schema.ts` (e.g. the Gigantamax modeling
  decision, mega columns, and `form_personal`'s shiny fields aren't fully
  reflected). Needs a dedicated sync pass.
- **Settings "Grid badges" fieldset**: it's the longest fieldset on the
  Settings page (up to `MAX_GRID_INDICATORS` pickable rows) and currently
  pushes everything below it down by default. Should be collapsible and
  start collapsed.

---

## 5. Status-TBD Items (Needs an Owner Decision: V1 or V2)

These are explicitly *not* bucketed as V1 or V2 yet — flagging them here so
they get a deliberate decision instead of silently defaulting to either.

- **Desktop packaging story**: a launcher script, calling
  `navigator.storage.persist()` on the web platform path, pinning the dev
  server port (browser storage is keyed by origin, so a drifting port
  silently "loses" data under another origin), and a minimal PWA manifest.
  This was v1-roadmap Theme 6 / task D3 and was still unresolved as of the
  last recovered status.
- **Rotating Android auto-export**: a once-daily auto-export, keeping the
  last 3 snapshots, via the already-integrated `@capacitor/filesystem`
  plugin. Scaffolding-adjacent work exists (manual Export/Import), but the
  automatic rotating version was never built.
- **On-device restore test**: an actual uninstall/reinstall test of
  Android's `allowBackup` auto-backup restore path has never been run on
  real hardware (only doable on a real device, not in this environment).
  The `allowBackup` stance itself was decided (kept on, treated as a
  supplementary net on top of manual Export), but whether it actually
  restores a sideloaded app's DB is unverified.
- **Gigantamax availability/shiny gating**: all 32 canonical G-max species
  are currently marked available (shiny included) in reference data, but
  GO's real in-game rollout since late 2024 is a subset, and shiny G-max is
  event-gated per species. This is a data-pass issue, not a code change.
  **Note**: this is only about the gating/availability data — the
  *architecture* decision to model Gigantamax as ordinary form rows (not a
  separate personal field) is already settled and unaffected.
