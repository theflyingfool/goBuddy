# Vue migration plan

Canonical plan for introducing Vue and the reworked UI (see the design
mockup discussion — palette, Collection, bulk log-a-catch, species
Tracking/Info split) into the app. This is a living document: update it as
milestones land or scope changes, don't let it drift from what's actually
built.

## Why

The current UI is hand-rolled vanilla TS + DOM helpers (`src/ui/dom.ts`).
That's served fine for the achievement-checklist era, but the new
per-specimen tracking (`pokemon_instance`, `tag`, multi-`profile`) adds
enough repeat-form surface area (log-a-catch, specimen edit, bulk apply)
that a real component/reactivity model earns its keep. Vue was chosen over
React/Svelte/Preact for its gentle learning curve and built-in
form-binding primitives (`v-model`, `computed`) that map directly onto the
repeated achievement-toggle and bulk-entry forms.

## Migration style: incremental, route-by-route

Vue gets mounted into specific routes as each screen is rebuilt; everything
else keeps running exactly as it is. No long-lived rewrite branch, no
big-bang cutover.

The seam is small and already exists: `src/main.ts`'s `render()` dispatches
on `parseRoute(location.hash)` to one `render<X>Page(contentEl, repo)` call
per route (see `src/app-shell/router.ts`'s `Route` union). Migrating a
screen means swapping that one call for a Vue `createApp(...).mount(contentEl)`
call. `router.ts`, the `Repository` interface, and the sidebar/tab-bar chrome
(`nav-drawer.ts`, `header.ts`) are untouched throughout — Vue components
receive `repo` as a prop/plugin, same as the vanilla render functions do
today.

Each vanilla render function must be properly unmounted before Vue takes
over a route it's never seen, and a mounted Vue app must be `.unmount()`-ed
before `render()` re-runs for a different route (today's vanilla functions
just `clear(container)` and rebuild; Vue needs an explicit teardown call or
it'll leak component instances / duplicate listeners on repeated navigation).
A small `mountVueRoute(container, component, props)` helper in
`src/app-shell/` should own this lifecycle so every migrated route uses the
same pattern.

## Phase 0 — Vue plumbing (no visible/behavioral change)

- Add `vue` (runtime dep) + `@vitejs/plugin-vue` (dev dep); wire the plugin
  into `vite.config.ts` (root stays `src`, nothing else changes).
- Add a `src/shims-vue.d.ts` module declaration so `tsc -b` (the existing
  `npm run build` type-check step) doesn't choke on `.vue` imports from
  `.ts` files. Real template type-checking (`vue-tsc`) is not in scope for
  Phase 0 — revisit if template bugs start slipping through.
- Add the `mountVueRoute` lifecycle helper described above.
- **Pilot screen: Settings.** Chosen because it has no cascades, no large
  dataset, and isn't visually changing — it exists purely to prove the
  mounting/unmounting pattern before anything higher-stakes depends on it
  being right. Port `src/features/settings/settings-page.ts` to a
  `SettingsPage.vue` component with identical behavior (theme picker,
  collapse-gender-forms toggle, exclude-regional-forms toggle, form-grid
  second-field picker, indicator checkboxes, export/import, about section).
  Delete the vanilla `settings-page.ts` once the Vue version is wired into
  `main.ts`'s `case "settings"` — no dual-maintenance period once it's
  proven out.

## Schema work — `medal_progress_personal`

Lands independently of any screen, tested on its own before the Trainer
page depends on it.

Good news discovered while scoping: `medal`/`medal_tier` reference
ingestion is **already fully wired** — `scripts/ingest/build-reference.ts`'s
`buildPlayerProgression()` already populates medals/medal tiers from
pogoapi.net's badges, and `reference-sync.ts` already syncs the `medal`/
`medal_tier` tables. This is purely additive on the personal side, no
ingestion work needed:

- New personal table `medal_progress_personal(medal_slug, profile_id,
  current_rank, current_count, updated_at)`.
- Bump `CURRENT_PERSONAL_SCHEMA_VERSION` to 5 in `src/db/schema.ts`, add the
  matching `{ version: 5, up }` entry to `MIGRATIONS` in
  `src/db/migrations.ts` (follow the same `ALTER TABLE`-or-`CREATE TABLE`
  pattern already used for schema version 4).
- Repository methods (`getMedalProgress`/`setMedalProgress` or similar) on
  the `Repository` interface, implemented in `sqlite-repository.ts` +
  `in-memory-store.ts`, following the existing `species_personal`/
  `mega_personal` pattern.
- A migration test in `test/migrations.test.ts`, same shape as the existing
  version-4 test.
- Add `medal_progress_personal` to the personal-data export/import shape
  (`PersonalDataExport` in `src/data/repository.ts`) so it round-trips
  through Settings' export/import like every other personal table.

**Explicitly not in scope**: friendship/buddy tracking. That's the separate
"Best Buddy Tracker" roadmap item (`docs/roadmap.md`) — there's no
`is_current_buddy` flag anywhere yet to build a Trainer-page friendship
section on top of, and pulling it in now would be scope creep on top of
scope creep.

## New Trainer/Profile page

New Vue screen. Consumes `player_progress_personal` (already modeled —
current level/XP) plus the new `medal_progress_personal`. Shows: profile
identity (username, friend code, `profile` table), trainer level/XP
progress bar, and per-medal progress (current tier + count vs. next-tier
target, from `medal_tier`).

## Milestone order

1. **Settings** *(Phase 0 pilot, above)*
2. **Trainer/Profile page** *(new — depends on the medal schema work above)*
3. **Dex grid + Bulk Edit merge** — see "Dex/Bulk Edit merge" below; this is
   more than a straight port.
4. **Species detail** — Tracking tab ports the existing achievement-toggle
   groups + cascade logic unchanged. Info tab (flavor text, CP calculator,
   PvP league rank, type matchups) is **partially blocked**: CP calculator
   and type matchups are fine (reads from base stats + `type_effectiveness`,
   both already in schema), but there is no flavor-text column on
   `species`/`form` today, and it's unconfirmed whether pokemon-go-api/
   pogoapi.net even expose GO-specific Pokédex text (vs. mainline-game
   flavor text, which may not apply to GO at all). Needs a source check
   before that one piece of the Info tab is real rather than mocked.
5. **Collection** — the one real scaling concern. With 12,000+ specimens in
   a real collection, this cannot use `in-memory-store.ts`'s full-table-scan
   filter pattern the way the Dex grid does. Needs paged/sorted real SQL
   (same style as `completion-stats-sql.ts`), not an in-memory filter over
   every row.
6. **Log a catch** — needs a new repository method to insert N
   `pokemon_instance` rows in one transaction with shared state fields
   (species, shiny/lucky/shadow/purified), distinct from the existing
   single-row personal-field setters. Quick mode's quantity stepper and the
   post-save "just logged, act on any of these now" results list are the
   product requirement driving this (see mockup).
7. **Stats** — port the existing lens engine (`completion-stats-sql.ts`)
   unchanged, add two new aggregate queries over `pokemon_instance`/`tag`
   for the new specimens-by-state and top-tags charts.

**Staying vanilla for now**, ported in a later pass: Search Tools, Coverage
Report, Achievements/XP Assistant stubs, Help.

## Dex/Bulk Edit merge

Owner's call: fold Bulk Edit into a "select multiple" mode on the Dex grid
rather than keep it a separate page/route.

**This is already half-true today**, discovered while scoping — worth
recording since it changes the shape of this milestone from "delete one
page" to "unify two mechanisms":

- `src/features/data-entry/species-grid.ts` already has a full select-mode
  (`GridState.selectMode`/`selectedSpecies`, the "Select" toggle, the
  "Apply to N" bar) — but it only targets **species-level** fields
  (`SpeciesBulkField` = `SPECIES_FIELDS`: registered/xxl/xxs/purified).
- `src/features/data-entry/bulk-form-edit.ts` is a **separate page** doing
  the same select-many-then-apply pattern, but for **form-level** fields
  (`FORM_PERSONAL_BOOLEAN_FIELDS`, the ~25 caught/shiny/lucky/shadow/dynamax
  booleans), with its own filter state and `groupForms()`-based
  gender-collapsed one-checkbox-per-form selection.

The real merge work is generalizing the grid's existing select-mode to
target *either* granularity — letting the "field to bulk-apply" picker
choose a form-level field, at which point tile selection needs to switch to
the form-grouped granularity `bulk-form-edit.ts` uses (a gender-split
species is one tile, but selecting it for a form-level field must still
mean "every form under it," matching today's Bulk Edit behavior — see the
existing Settings-page note about this exact gotcha). Once the grid's
select-mode covers both, `bulk-form-edit.ts` and its route/nav entry get
deleted, not deprecated-and-kept.

## Non-goals (this plan)

- Any visual/behavioral change to Search Tools, Coverage Report,
  Achievements/XP Assistant, Help — untouched until their own migration
  pass.
- Friendship/buddy/Best-Buddy tracking (separate roadmap item).
- `vue-tsc` template type-checking (revisit if needed).
- Personal/reference DB file split, identity/slug rework — both already
  deferred to V2 per `docs/data-model.md`, unaffected by this plan.

## Status

- [x] Phase 0: Vue plumbing + Settings pilot
- [x] `medal_progress_personal` schema + migration (v5) + repository support
- [x] Trainer/Profile page (`src/features/trainer/TrainerPage.vue`) — level/XP + medal progress
- [x] **Dex grid + Bulk Edit merge.** Owner call to do this now despite the
      breakage risk flagged above. Implementation is a granularity toggle
      inside the grid's existing select-mode (`species-grid.ts`'s
      `bulkGranularity: "species" | "form"`) rather than a rewrite:
      "Species fields" is the grid's original select-mode, unchanged;
      "Form fields" hands the content area to `bulk-form-edit.ts`'s existing
      render function, rendered into a slot inside the grid page instead of
      its own route — that file's filter/search/apply logic is completely
      untouched, only its call site moved. `/bulk-edit` and the "Bulk Edit"
      nav entry are gone; the route falls through to the grid.
- [x] **Visual pass to match the approved mockup** (palette, specimen-tag tile
      shape, pill segmented/toggle/filter controls, chart-card/hbar stats,
      field-log form language) — `src/style.css`'s tokens and shared component
      classes were ported from the mockup and applied across every screen
      (mostly via existing class names + a global `fieldset`/`.toggle-row`
      reskin, so page markup mostly didn't need to change). Stats gained a
      chart-first layout (XP card, specimens-by-state, top tags) with the old
      completion table demoted to a collapsed "Full completion breakdown"
      rather than being the whole page. Database/schema work is explicitly
      out of scope for this pass (Drizzle migration + DB cleanup planned
      next).
- [x] Species detail (src/features/data-entry/SpeciesDetailPage.vue) — Tracking + Info tabs, full Vue rewrite (supersedes the earlier "additive, not a Vue rewrite" note).
      Info tab shows real type matchups. CP calculator and flavor text show an
      honest "not available yet" message rather than fabricated numbers —
      confirmed while building this that base stats and flavor text aren't in
      the ingested reference data at all (`v2-schema-design.md`'s base-stat
      columns were sketched but never actually added). A real fix needs an
      ingestion pipeline change, out of scope here. `groupForms`/`FormGroup`/
      `megaVariantLabel`/the `collapse_gender_forms` setting key moved to
      `src/features/data-entry/species-detail-shared.ts`, shared with
      `bulk-form-edit.ts`, since the old `species-detail.ts` they lived in is
      now deleted.
- [x] Collection (`src/features/collection/CollectionPage.vue`) — filters/sorts
      over the in-memory cache, same as every other screen today. The plan's
      "needs real paginated SQL for 12,000+ specimens" concern is **not**
      resolved — this works but isn't scale-proven, and is the first thing to
      revisit if Collection feels slow with a large collection.
- [x] Log a catch (`src/features/log-catch/LogCatchPage.vue`) — Quick mode's
      quantity stepper bulk-inserts N `pokemon_instance` rows in one
      transaction (`Repository.createPokemonInstances`); Full details adds
      CP/IV/nickname/tags to a single catch. Post-save shows a "just logged"
      list with per-row trade/evolve/release actions.
- [x] Stats (`src/features/stats/StatsPage.vue`) — wraps the existing
      `stats-page.ts` completion table unchanged (mounted via a thin Vue host,
      not rewritten — same reasoning as Species detail) plus two new charts:
      specimens-by-state and top-tags (`getSpecimenStateCounts`/
      `getTopTagCounts`).
- [x] Help (src/features/help/HelpPage.vue) — static content, direct port.
- [x] Coverage Report (src/features/coverage-report/CoverageReportPage.vue) — direct port, same per-fieldset CSV export behavior.
- [x] Dex grid + Bulk Edit (src/features/data-entry/DexGridPage.vue, BulkFormEditPanel.vue) — full Vue rewrite, species-grid.ts and bulk-form-edit.ts deleted.

**Known gap, not addressed this pass:** `PersonalDataExport`/`importPersonalData`
now export `pokemonInstances`/`tags` for completeness (so a rescue export or
backup doesn't silently drop them) but do **not** merge-import them —
`pokemon_instance.id`/`tag.id` are local AUTOINCREMENT integers with no
cross-device meaning, unlike every other personal table's slug-keyed rows, so
naively merging by id would conflate unrelated individuals from two different
devices. Real cross-device merge semantics for individual specimens needs a
deliberate identity decision, not a quiet id-based guess.
