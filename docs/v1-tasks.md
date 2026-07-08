# V1 Task Breakdown

*Companion to `docs/v1-roadmap.md` (the six-specialist studio review + the
2026-07-08 owner-decisions addendum). That file explains the **why**; this
file is the **what**, broken into tasks sized roughly an hour to a day each,
in dependency order. Work top to bottom within each section; sections are
ordered so nothing depends on something later in the list. Check items off as
they land. Each item names its critical file(s) so a session can start
straight from this list without re-exploring.*

---

## 0. Already decided — don't re-litigate these

From `docs/v1-roadmap.md` Phase 0:
- **D1 — Gigantamax modeling: RESOLVED.** Form-rows-only (commit `36e5754`
  already does this) — no extra personal field. Owner confirmed 2026-07-08.
- D2 (form-complete semantics), D3 (desktop packaging), D4 (keystore backup
  location), D5 (`allowBackup` stance), D6 (app name), D7 (costume-code
  confirmation) — **still open**, each is its own task below.

From the 2026-07-08 addendum:
- Identity/slug rework → **V2** (see § 12), unified with image-pipeline IDs.
- Reference/personal DB file split → **V2** (see § 12); the insert-loop
  performance fix is a **V1 contingency** on real-device timing (§ 8, § 11).
- Image pipeline (species + per-form art) → **full scope, V1** (§ 7).
- Visual identity pass → **new V1 workstream**, sequenced before legibility
  fixes (§ 3, then § 4).

**Carried-over open questions** (non-blocking, revisit opportunistically):
the `001-Bulbasaur/Standard.md` Obsidian-refs question (may hold real personal
progress — decide before deleting that folder); whether to verify the
Uxie/Mesprit/Azelf/Malamar/Falinks "bogus mega-capable" flags against the
Z-A mega list (§ 1 touches this); whether the ~65 unverified-genderless
species and 385 inherited-availability forms need a manual pass or can ride
as Coverage-Report-flagged caveats (lean: ride).

---

## 1. Reference-data correction pass

*Do this before any real device holds personal data — slugs are immutable by
design, so fixes here are free today and permanent debt later.*

- [ ] Fix Necrozma fusion names: swap "Dawn Mane"/"Dusk Wings" → **Dusk Mane**
  (Solgaleo fusion) / **Dawn Wings** (Lunala fusion). `scripts/ingest/build-reference.ts`
  or the Forms CSV source, wherever the name string originates.
- [ ] Purge phantom "Standard" form rows for: Deoxys, Giratina, Shaymin,
  Zygarde, Hoopa, Genesect, Basculin, Oricorio, Sinistea, Urshifu, Enamorus,
  Furfrou, Vivillon, Maushold, Dudunsparce. Extend `NO_STANDARD_FORM_NAMES` in
  `scripts/ingest/pokemon-facts.ts` (same mechanism already used for Unown).
  **Migrate the `shiny_available`/shiny-personal flag from the phantom row to
  the real default form** as part of the same change — verify per species.
- [ ] Fix gen-9 slug/name typos: `ogrepon`→`ogerpon`, `fezanipiti`→`fezandipiti`,
  `sinistchai`→`sinistcha` **and its dex number 1012→1013** (currently
  duplicates Poltchageist). Display-name fix: "Pharoah"→"Pharaoh" (Furfrou).
- [ ] Add Crowned Sword Zacian / Crowned Shield Zamazenta forms (in GO since
  GO Fest 2025).
- [ ] Add the six missing `mega_variant` rows: Mega Pidgeot, Mega Kangaskhan,
  Mega Mewtwo X, Mega Mewtwo Y, Primal Kyogre, Primal Groudon. Note: current
  data has **zero** Mewtwo mega rows and `species.canMegaEvolve: false` for
  Mewtwo — fix `can_mega_evolve` too, not just add the variant rows.
- [ ] Tighten Gigantamax availability/shiny-availability gating to GO's actual
  rollout (all 32 canonical G-max species are currently marked available,
  shiny included — GO's rollout since late 2024 is a subset).
- [ ] Correct the "Mega Dimension" documentation error: it's official *Legends:
  Z-A* DLC, not fan content (fix the claim in `TODO.md`/ingestion comments).
  Re-verify the Uxie/Mesprit/Azelf/Malamar/Falinks "bogus mega-capable" flags
  against the official Z-A mega list before "correcting" them — they may be
  the tracker being *ahead* of the pipeline. Fix the false "Audino has no
  official Mega" claim (Mega Audino is ORAS-era and already in the data).
- [ ] **D7**: confirm the ~11 costume code identifications against Bulbapedia
  sprite images before slugging (Cap Pikachu O=Original/W=World; Flying
  Pikachu Fly/Fly5/FlyOkinawa/FlyGreen/FlyPurple/FlyOrange/FlyRed — see
  `docs/v1-roadmap.md` Theme 2 §7 for the proposed names). Apply once confirmed.
- [ ] Fix the lucky-IV-floor comment in `docs/data-model.md` (~10/10/10 →
  12/12/12; non-load-bearing, just a stale comment).
- [ ] Once § 9's slug-stability check script exists, run it against this pass's
  output before merging, to confirm nothing was accidentally renamed instead
  of corrected-in-place.

---

## 2. Data-safety net

*The app's entire value is one SQLite file on a phone — these close the ways
that file (or a friend's trust in it) can currently be lost.*

- [ ] **D4**: decide keystore backup location, then generate a dedicated
  release keystore, add `signingConfigs.release` to `android/app/build.gradle`,
  switch the build to `assembleRelease`. Back it up in ≥2 places.
- [ ] Boot-failure rescue screen: on any DB-open/sync/migration error
  (`src/main.ts`'s "Couldn't open the on-device database" path), still offer a
  raw "export personal data" action that reads the personal tables directly,
  bypassing the failed boot path.
- [ ] Reference-sync orphan quarantine: in `src/db/reference-sync.ts`, detect
  personal rows whose slug no longer resolves after reference tables are
  recreated, and move them to a quarantine table instead of letting the
  transaction commit fail.
- [ ] Ingestion-time slug-disappearance check — pairs with § 9's slug-stability
  script; fail the build if a slug vanishes without a rename-registry entry.
- [ ] Write-failure banner: surface `src/data/sqlite-repository.ts`'s
  swallowed write errors (~line 96-98) as a persistent in-app banner with
  retry, instead of `console.error`-only.
- [ ] Import: report the count of skipped/unknown-slug rows instead of
  silently dropping them (`src/data/in-memory-store.ts`'s import path).
- [ ] Pre-import auto-snapshot: call the existing `exportPersonalData()`
  before applying any import, in `src/features/settings/settings-page.ts`.
- [ ] Call `navigator.storage.persist()` on the web platform path
  (`src/db/sqlite-client.ts`).
- [ ] Rotating Android auto-export: once-daily, keep last 3, via the
  already-integrated `@capacitor/filesystem` plugin.
- [ ] Migration-runner hardening: wrap each migration in a transaction
  (`src/db/migrations.ts`), refuse to boot if the stored schema version is
  newer than the app's (downgrade guard).
- [ ] **D5**: decide and document the `android:allowBackup` stance
  (`android/app/src/main/AndroidManifest.xml`); test restore once if keeping
  it on.

---

## 3. Visual identity pass (new — do this before § 4)

*The owner: "We need a more professional UI from day one." This is real
design work — not pre-decided in this planning pass.*

- [ ] Define the visual direction: a considered palette (named hex values,
  not defaults), a type pairing (display + body face), and a spacing/layout
  system. Treat as its own dedicated design session/pass, not a quick pick.
- [ ] Apply the system to the app shell: `src/style.css` design tokens,
  `src/app-shell/header.ts`, `src/app-shell/nav-drawer.ts`.
- [ ] Apply to the species grid: tiles, filter chips, filter bar
  (`src/features/data-entry/species-grid.ts`).
- [ ] Apply to species detail: fieldsets, form groups, overview grid
  (`src/features/data-entry/species-detail.ts`).
- [ ] Apply to the stats page: table, progress bars
  (`src/features/stats/stats-page.ts`).
- [ ] Apply to Settings (`src/features/settings/settings-page.ts`).
- [ ] Dark-mode audit against the new system — `color-scheme: light dark` is
  already set (`src/style.css`); verify it still holds with the new palette,
  then add a manual override toggle (can slip to V1.x if time-constrained).

---

## 4. Legibility & accessibility polish (after § 3)

- [ ] Chip legibility: full labels or a tap-reachable legend for the filter
  chips (currently glyph-only with hover-only tooltips); add `aria-pressed`
  for tri-state chips (`src/features/data-entry/species-grid.ts`,
  `src/features/data-entry/indicator-labels.ts`).
- [ ] Add a form-name filter box to the species detail page (currently
  unsearchable at high form counts, e.g. Pikachu's 188 forms) —
  `src/features/data-entry/species-detail.ts`.
- [ ] Remove `maximum-scale=1.0` to restore pinch-zoom (`src/index.html`).
- [ ] Nav drawer accessibility: `inert`/`visibility:hidden` when closed,
  Escape-to-close, focus management on open/close, `aria-expanded` on the
  hamburger (`src/app-shell/nav-drawer.ts`, `src/app-shell/header.ts`,
  `src/main.ts`).
- [ ] Fix the bulk-edit search-input focus-loss bug — the page rebuilds
  around the input on every keystroke (`src/features/data-entry/bulk-form-edit.ts`
  ~line 96-100).
- [ ] In-place select-mode tile toggling (avoid full-grid rebuild per tap) +
  debounce the grid filter input (`src/features/data-entry/species-grid.ts`,
  `src/main.ts`).
- [ ] Nav de-noising: collapse the stub pages (Search Tools, Achievements, XP
  Assistant) under a muted "Coming later" group; move Coverage Report behind
  Settings or a dev flag (`src/app-shell/nav-drawer.ts`).
- [ ] Stats drill-down: `scrollIntoView` on the missing-species detail panel,
  make species names link to `speciesDetailPath` (`src/features/stats/stats-page.ts`).
- [ ] Add an `aria-live="polite"` status region for async states (Computing…,
  Exporting…, Imported…).
- [ ] Species detail: rebuild only the toggled form group in place instead of
  the whole page per checkbox (`src/features/data-entry/species-detail.ts`).
- [ ] Set `alt=""` on grid tile sprite images (currently duplicate the visible
  name label to screen readers) — `src/features/data-entry/species-grid.ts`.

---

## 5. Mega evolution vertical slice

*Depends on § 1's mega reference-data fixes landing first.*

- [ ] Repository: add `getMegaVariantsForSpecies(speciesSlug)` and mega
  read/write methods to `src/data/repository.ts`,
  `src/data/sqlite-repository.ts`, `src/data/in-memory-store.ts`.
- [ ] Boot: load `mega_personal` into the in-memory cache
  (`src/data/sqlite-repository.ts`'s `loadPersonalState`).
- [ ] Extend `PersonalDataExport` to include `megaPersonal` (and
  `formBackgroundPersonal`, same gap) — `src/data/repository.ts`. Treat this
  as a personal-schema-version-relevant export-shape change.
- [ ] UI: new "Mega" section on the species detail page, positioned near
  Purified, iterating N `mega_variant` rows for the species (0 for most
  species, 1 for single-variant megas, 2 for Charizard) — one **Evolved** /
  **Shiny Evolved** toggle pair per row (`src/features/data-entry/species-detail.ts`).
  This needs a new rendering pattern (iterate a repo-fetched array), since
  `SPECIES_FIELDS`'s fixed `keyof` shape in `field-groups.ts` can't express a
  variable-cardinality set — closer to how form groups are already iterated.
- [ ] Stats lens + grid filter chip for mega completion — should mostly fall
  out of the existing generic achievement-lens machinery once the repository
  methods above exist.

---

## 6. Gigantamax + form-complete semantics

- [ ] Hide the redundant Dynamax/Lucky-Dynamax toggle groups on Gigantamax
  form rows (they carry `dynamaxAvailable: true` today, showing groups that
  describe the same catch event as the G-max row's own Standard branch) — use
  the existing `availableWhen` mechanism in `src/features/data-entry/field-groups.ts`.
- [ ] **D2**: decide form-complete denominator — exclude regional-exclusive
  forms from the default lens (they currently make form-complete unattainable
  for region-locked species); consider a separate "G-max-complete" lens.
- [ ] Implement the chosen denominator logic
  (`src/data/completion-stats-sql.ts` ~line 65).

---

## 7. Image pipeline (new, expanded scope)

*The image folder is a git checkout of `PokeMiners/pogo_assets` — official
Niantic-sourced extraction, 2,213 PNGs, dex 1–867, at
`Refs from Obsidian/pogo_assets/Images/Pokemon - 256x256`.*

- [ ] Species-level art swap: copy/convert `pokemon_icon_{dex:3}_00.png` (and
  `_shiny` variants) into `public/sprites/`, replacing the current 001–809 set
  and extending through 1024 where PokeMiners has coverage (dex 1–867 today —
  note some of the newest species may still be missing from PokeMiners itself
  and need a fallback).
- [ ] Build the form/costume numeric-ID → name lookup table: source the
  Pokémon GO game-master's form/costume ID enum (publicly documented via
  PokeMiners' companion repos or derived community JSON dumps) and check it
  into the repo (e.g. `scripts/ingest/pogo-form-ids.json`).
- [ ] Cross-reference that table against `reference.json`'s
  `form_name`/`costume_name` strings to populate `form.imageRef` for the
  first time (currently reserved, unused, always null) —
  `scripts/ingest/build-reference.ts`.
- [ ] Copy the matched per-form PNGs (including `_shiny` variants) into a
  form-level asset directory (e.g. `public/sprites/forms/`).
- [ ] Add `formSpritePath()` to `src/ui/sprites.ts`, falling back to
  `speciesSpritePath()` when a form has no confident match.
- [ ] Wire `src/features/data-entry/species-grid.ts` and
  `src/features/data-entry/species-detail.ts` to prefer per-form art where
  available.
- [ ] Decide whether the shiny achievement toggle should swap displayed art to
  the `_shiny` PokeMiners variant, and implement if yes.

---

## 8. Performance / first-impression fixes

*Most legibility-adjacent performance items already live in § 4 (bulk-edit
focus bug, select-mode jank, species-detail rebuild). This section is the
remaining first-boot/device-specific items.*

- [ ] Real-device install + first-boot timing test (the reference sync does
  ~8,156 sequential inserts on first run / on any reference-data-changing
  update — untested on real hardware). This is also § 11's release-candidate
  gate.
- [ ] **Contingency**: if the timing test shows the sync is slow enough to
  hurt the first-run experience, pull forward the `executeSet`-batching fix
  for `src/db/reference-sync.ts` (the SQLite plugin already supports this;
  see `docs/v1-roadmap.md` addendum point 2). Otherwise, defer to V2 with the
  DB-split work.

---

## 9. Quality infrastructure

- [ ] Slug-stability check script: diff new `reference.json` slugs against
  the last committed version; fail if any slug vanished without a matching
  entry in `src/db/slug-renames.ts`. (Feeds § 1 and § 2's checks.)
- [ ] Migration fixture tests: a thin adapter running the real migration +
  sync code (`src/db/migrations.ts`, `src/db/reference-sync.ts`) against
  fixture databases via Node's built-in SQLite — reuse the prepared-statement
  pattern already proven in `scripts/build-dummy-db.ts`.
- [ ] Export/import round-trip unit tests (`src/data/in-memory-store.ts`).
- [ ] Committed Playwright smoke suite: boot, toggle+reload persistence,
  stats counts, export/import, settings — the scenarios already verified
  manually per `TODO.md`, made repeatable.
- [ ] CI workflow: `tsc -b --noEmit` + unit tests + the smoke suite on PR
  (lint is already enforced pre-commit locally, per `CLAUDE.md`'s
  "Development workflow" — CI should still run it too, as a backstop).
- [ ] Upgrade `eslint.config.js` from `typescript-eslint`'s `recommended` to
  `recommendedTypeChecked` (needs `parserOptions.project` wired up, and a
  separate lighter block for root-level config files like `vite.config.ts`
  that aren't in the `tsconfig.json` `include`). Turning this on the first
  time surfaced real issues worth fixing deliberately: unawaited promises in
  `src/main.ts` and `src/features/stats/stats-page.ts`
  (`no-floating-promises`), promise-returning handlers passed where a sync
  callback is expected in `settings-page.ts`/`coverage-report-page.ts`
  (`no-misused-promises`), and `any` leaking from untyped raw SQL query rows
  throughout `src/data/sqlite-repository.ts` (`no-unsafe-assignment`/
  `no-unsafe-member-access` — fixing this properly means typing the DB row
  shape at the query boundary, not just silencing the rule).
- [ ] Delete dead code: `src/data/dummy-repository.ts`,
  `src/data/personal-demo-seed.ts`, and the in-memory JS stats path
  (`computeLens` in `src/data/in-memory-store.ts`) — make stats SQL-only via
  `src/data/completion-stats-sql.ts`.
- [ ] Remove the `INTERNET` permission from `AndroidManifest.xml` (the app
  makes no runtime network calls; let the OS enforce it).
- [ ] Move the stray 38MB `GoBuddy.apk` out of the repo root.
- [ ] **D6**: pick one app name (PoGo Buddy vs GoBuddy) and align
  `appName`/export filenames/repo references.

---

## 10. Documentation & release process

- [ ] Commit `docs/` (currently untracked while committed files link to it —
  do this first, it's blocking a clean clone today).
- [ ] In-app Help page: badge/glyph legend, lens definitions
  (Registered/Form-complete/Costume-complete + denominator rule),
  floor/shundo glossary, tri-state chip explanation.
- [ ] Backup guidance text next to the Export button
  (`src/features/settings/settings-page.ts`): "this file is your only
  backup; export after play sessions."
- [ ] Install/update one-pager for friends, shipped alongside the APK link:
  sideload steps, "install the new APK over the old one — your data
  survives."
- [ ] Write `docs/ingestion-runbook.md`: the correct script order
  (`ingest:fetch` → `ingest:gigantamax` → `ingest:build` → `ingest:events` →
  `ingest:csv:import -- <path>`), the silent-skip and destructive-reorder
  pitfalls already found, and the slug-diff checkpoint step.
- [ ] Release checklist + start a `CHANGELOG.md` (version bump, tag, build,
  upgrade-install test, "export before updating" reminder).
- [ ] Refresh `TODO.md`: remove the now-resolved "Gigantamax field" open item,
  fix the false `form.gigantamax_available` column claim.
- [ ] `docs/data-model.md` divergence pass: add the Gigantamax modeling
  decision, the mega columns, `form_personal`'s shiny fields, and other
  DDL-vs-`schema.ts` drift found by the documentation review.
- [ ] Show the app version somewhere in Settings.
- [ ] Write the auto-declutter engine's safety clause into `docs/features.md`
  now, while it's fresh (cheap insurance for a V1.x feature): generated
  transfer-search strings must exclude `favorite`/`specialbackground` by
  default and protect shiny/lucky/costume/legendary; decide the 0★ inclusion
  question and the multi-rule priority order.

---

## 11. Release candidate

- [ ] Real-device install + first-boot timing (resolves § 8's contingency).
- [ ] Upgrade-over-install test: v1 APK + real data → v2 APK, confirm data
  survives and no boot-brick.
- [ ] Confirm the § 9 smoke suite + CI are green.
- [ ] Tag `v1.0.0`.
- [ ] Distribute with the install/update one-pager (§ 10).

---

## 12. V2 watchlist (explicit, so nothing here gets lost)

- Identity/slug rework unified with the image-pipeline's numeric IDs (§ 7) —
  likely Niantic's own game-master form/costume ID enum as the stable key,
  slug becoming a purely cosmetic/display column.
- Reference/personal database file split (two physical SQLite files).
- Full adoption of `executeSet`/`importFromJson`/`copyFromAssets` if not
  pulled into V1 via § 8's contingency.
- Search-string builder (safety-adjacent spec work already done in § 10).
- Auto-declutter engine (safety clause specced in § 10; multi-rule priority
  order still needs deciding when this is built).
- Purified per-form branch (purified-lucky/shiny/hundo), `paradox` rarity,
  Hisui/"Unknown" dex-region alignment, Alcremie's decoration explosion (if
  Milcery reaches GO), mega level (Base/High/Max) column, the Z-A-megas
  ingestion-filter update (when those megas reach GO).
- **D3**: desktop packaging, if not resolved during V1 (roadmap recommends
  the launcher-script option).
- Dark-mode manual toggle, one ≥768px desktop breakpoint (if not finished in
  § 3/§ 4).
