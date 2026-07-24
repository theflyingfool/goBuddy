# Sub-project 3: Vue Migration Completion + Visual Fidelity — Design

> Part of the [V2 consolidation roadmap](2026-07-23-v2-consolidation-roadmap.md).
> This is the design for that roadmap's Sub-project 3 only.

## Goal

Finish the Vue migration (no more vanilla-TS pages with real functionality)
and close the visual-fidelity gaps against the approved mockup, per the
roadmap's scope boundary: **Search Tools / Achievements / XP Assistant stay
out of scope** — those are unbuilt stub features, not migration debt.

## What this reuses vs. what's new

`docs/vue-migration-plan.md` already establishes the mechanics every page
migration follows — `mountVueRoute()` lifecycle, incremental route-by-route
cutover, delete the vanilla file once its Vue replacement is wired in. This
design doesn't re-derive any of that; it only covers what's genuinely new:
which pages get migrated this pass, and the three real UI decisions
(Stats redesign, medals grid, FAB placement).

## Scope

### 1. Migrate remaining vanilla-TS pages to real Vue SFCs

Confirmed (full rewrite, not additive) for all four:
- **Coverage Report** (`coverage-report-page.ts` → `CoverageReportPage.vue`) —
  low risk, no complex interaction state.
- **Help** (`help-page.ts` → `HelpPage.vue`) — low risk, static content.
- **Species detail** (`species-detail.ts` → `SpeciesDetailPage.vue`) —
  Tracking/Info segmented view, achievement toggle groups, specimens strip,
  CP calculator. Real state and cascade-triggering interactions; this is
  where regressions are most likely, so its own careful task with explicit
  before/after behavior parity checks against the current vanilla version.
- **Dex grid + Bulk Edit** (`species-grid.ts` + `bulk-form-edit.ts` →
  `DexGridPage.vue`) — the highest-risk piece: search/filter, the
  species/form granularity toggle for select-mode, cascade-triggering
  bulk-apply, and the existing merged-page behavior (`/bulk-edit` route
  already deleted, folded into a slot inside the grid). Every existing
  behavior documented in `vue-migration-plan.md`'s "Dex/Bulk Edit merge"
  section must survive the rewrite unchanged; `bulk-form-edit.ts` gets
  deleted once its logic is ported in, not kept as a wrapped legacy call
  (matching the "delete once migrated" rule, unlike Stats' current
  wrapped-renderer approach, which this pass does NOT touch — see below).

Once all four are done, `src/ui/dom.ts`'s helpers should have no remaining
callers outside test fixtures — confirm and remove dead exports as a
closing step, not a separate task.

### 2. Stats page: add a global lens-progress list

**Correction from the original design pass**: `StatsPage.vue` has moved on
since this doc's first draft (a later commit — "Log XP/level history;
surface player stats and medals on Stats page" — added more than this doc
accounted for). It already has: a 3-card KPI row (Trainer level, Specimens
logged, Medals started), an XP **sparkline** chart (historical trend from
`player_progress_log`, richer than the mockup's static progress-to-next-level
bar), a "Top medals" bar chart, Specimens-by-state, Top tags, and the old
completion table collapsed under "Full completion breakdown". The KPI
row/XP sparkline/top-medals chart already exceed the mockup's ambition —
**keep all of it as-is**, don't regress the sparkline back to a dumber
static bar just to match the mockup literally.

The one genuine gap: the mockup's flat **lens-progress list** (a plain
progress bar per named lens, not buried in the collapsed table) doesn't
exist yet. Add it as a new card between the KPI row and the existing
charts, using `Repository.getCompletionStats({ kind: "global" }, lenses)`
(already exists, `src/data/repository.ts:254`, powers the existing
collapsed table via `stats-page.ts`) with these five lenses — a
deliberate substitution of the mockup's row set, since "Achievement-complete"
isn't a real single lens in this data model (achievement lenses are
per-field, e.g. `{ kind: "achievement", field: "shiny" }`, not one
combined summary):
- `{ kind: "registered" }` → "Registered"
- `{ kind: "formComplete" }` → "Form-complete"
- `{ kind: "costumeComplete" }` → "Costume-complete"
- `{ kind: "gigantamaxComplete" }` → "Gigantamax-complete"
- `{ kind: "megaComplete" }` → "Mega-complete"

Each row: label, a plain progress bar (reuse `.bar-track`/`.bar-fill`,
already defined for the XP card), and the `complete / total` fraction as
text (`CompletionLensResult.complete`/`.total`).

### 3. Trainer page: medals list → grid

Replace `TrainerPage.vue`'s `.medal-row` vertical list with a grid of
medal tiles, reusing the app's existing tile visual language (the
`tag-tile`/dex-grid tile pattern already established in `src/style.css`)
rather than inventing a new component style:
- Each tile: medal name (truncated if needed), current tier as a small
  badge/indicator, and a compact progress indicator toward the next tier
  (reusing the count input already present — kept as-is, just re-laid-out
  inside the tile rather than a full-width row).
- Same sort order as today (event medals last, then alphabetical).
- Grid, not carousel/scroll-list — matches the Dex grid's
  `repeat(auto-fill, minmax(...))` pattern for responsive column count.

### 4. Log-a-catch FAB

Per owner decision: appears on **both** the species detail page (Tracking
tab, matching the mockup) and the Dex grid page — owner confirmed both
placements, not just the mockup's species-detail-only version.
- **Species detail**: deep-links to Log-a-catch pre-filled with that exact
  species (matches mockup behavior).
- **Dex grid**: opens Log-a-catch with no species pre-filled (grid has no
  single "current" species context) — lands on today's existing species
  picker/search step unchanged.

Both reuse the same FAB visual treatment (`.fab` styling already defined
in the mockup's CSS tokens, to be ported into `src/style.css` as part of
this task rather than reinvented).

## Out of scope (unchanged from the roadmap doc)

- Building Search Tools, Achievements, XP Assistant — stub pages, real
  feature work, not migration debt.
- SQL-backed pagination for Collection's `pokemon_instance` scan — real
  gap, but unrelated to this pass; stays logged to `docs/roadmap.md`.
- Any change to `Repository` interface semantics — this pass is UI-layer
  only; no new repository methods beyond what's already exposed (the
  Stats hero tiles/XP bar/lens list all read from existing methods).

## Testing approach

- Species detail and Dex grid rewrites: before starting each, capture the
  current vanilla behavior as a Playwright e2e checklist (toggle cascades,
  select-mode granularity switch, search/filter) and re-run it against the
  Vue replacement before deleting the vanilla file — this is the
  highest-regression-risk part of the whole sub-project.
- Coverage Report / Help: existing behavior is simple enough that a
  visual/manual check is sufficient; no new e2e coverage required beyond
  what already exists.
- Stats/medals/FAB: new Playwright coverage for the new interactive
  elements (FAB navigation from both entry points, medal count edits in
  the new grid layout) — `settings-and-export.spec.ts`'s sibling e2e specs
  are the pattern to follow.
