*Part of the [V1 Task Breakdown](README.md). Previous: [3–4. Visual identity & legibility](03-visual-and-legibility.md). Next: [7. Image pipeline](05-image-pipeline.md).*
*Roadmap context: [Theme 3 — Feature rescoping](../v1-roadmap/03-feature-rescoping.md).*

## 5. Mega evolution vertical slice

*Depends on [§ 1](01-reference-data-correction.md)'s mega reference-data fixes landing first.*

- [x] Repository: `getMegaVariantsForSpecies(speciesSlug)` (returns variant +
  personal paired, same shape as `getSpeciesWithForms`'s form pairing) and
  `setMegaPersonalField` added to `src/data/repository.ts`,
  `src/data/sqlite-repository.ts`, `src/data/in-memory-store.ts`,
  `src/data/dummy-repository.ts`. Mega is confirmed species-wide (any
  non-Shadow individual can be temporarily Mega Evolved regardless of
  costume) — no per-form gating needed, matching `mega_variant`'s existing
  species-keyed (not form-keyed) schema. Cascade: `shinyEvolved` implies
  `evolved` implies `species_personal.registered` (forward-only, same rule
  as every other cascade in this app).
- [x] Boot: `mega_personal` (and `form_background_personal`, closing the same
  gap) loaded into the in-memory cache —
  `src/data/sqlite-repository.ts`'s `loadPersonalState`.
- [x] Extended `PersonalDataExport` with `megaPersonal`/`formBackgroundPersonal`
  — `src/data/repository.ts`. **Decided against a `CURRENT_PERSONAL_SCHEMA_VERSION`
  bump**: no DB table structure changed (both tables already existed,
  unused), so there's nothing for the migration runner to actually migrate;
  bumping the version number with no matching `MIGRATIONS` entry would leave
  real devices' stamped `schema_version` permanently stuck below the
  in-code constant (traced through `src/db/migrations.ts`'s `pending`
  filter). Instead both new fields are optional on the type and
  `importPersonalData` treats an absent key as "this export predates mega
  tracking," not an error. Also closed the identical gap in
  `src/data/boot-rescue-read.ts` (the boot-failure rescue path shares this
  export shape, per its own comment).
- [x] UI: new "Mega" fieldset on the species detail page, right after
  Species/Purified, iterating `getMegaVariantsForSpecies` (0 rows for most
  species, 1 for single-variant megas, 2 for Charizard/Mewtwo) — one
  **Evolved** / **Shiny Evolved** toggle pair per row
  (`src/features/data-entry/species-detail.ts`). Uses the page's existing
  full-rerender-on-toggle pattern (same as every other toggle here) rather
  than a clever in-place patch, specifically so the Species fieldset's
  Registered checkbox doesn't go stale when the mega-evolved cascade flips it.
- [x] Stats lens (`megaComplete`/`megaShinyComplete`, added to `CompletionLens`,
  `src/data/completion-stats-sql.ts`, and `src/features/stats/lens-labels.ts`'s
  new `MEGA_LENSES` — surfaced in Stats' "More lenses" section, not the
  always-visible KPI row, since it only applies to ~48 of 1024 species) +
  grid filter chip (`megaEvolved`, `src/data/repository.ts`'s new
  `MegaAchievementFilterField`, in the grid's "More filters" section
  alongside the other achievement toggles — distinct from the pre-existing
  `megaCapable` reference-availability chip in Classification). Deliberate
  semantic split: the grid chip is any-variant-OR (matches the indicator-badge
  convention), the stats lens is all-variants-required (matches
  formComplete/costumeComplete's stricter denominator) — same distinction
  already used elsewhere in this app between quick filters and completionist
  stats.

---

## 6. Gigantamax + form-complete semantics

- [x] Hid the redundant Dynamax/Lucky-Dynamax toggle groups on Gigantamax form
  rows: `isGigantamaxForm(form)` (exported from
  `src/features/data-entry/field-groups.ts`, detects `formName === "Gigantamax"`
  / `"Gigantamax {style}"` — the only reliable signal, no dedicated schema
  flag) now excludes those rows from both groups' `availableWhen`. A
  Gigantamax row's own Standard section (caught/shiny/floor/fourStar/shundo)
  already *is* the Gigantamax encounter — there's no separate "regular"
  version of that form to Dynamax on top of it.
- [x] **D2 resolved** (owner decision, 2026-07-09): **regional-exclusive
  forms** — a new Settings toggle ("Exclude regional-exclusive forms from
  Form-complete", `EXCLUDE_REGIONAL_SETTING_KEY` = `exclude_regional_form_complete`,
  default **off**), not a hardcoded exclusion — some players can actually
  reach region-locked forms (an alt account, travel, trading), so this is a
  per-install choice, not one fixed answer for everyone. **Gigantamax** —
  split into its own `gigantamaxComplete` lens (same "only count species that
  actually have one" denominator as `costumeComplete`/`megaComplete`) and
  removed from Form-complete's denominator entirely, unconditionally (no
  toggle — a G-max encounter is rare/one-off for everyone, not a
  region-dependent capability like the regional case above).
- [x] Implemented in both `src/data/completion-stats-sql.ts` (SQL:
  `formCompleteLens` takes an `excludeRegional` param and always excludes
  Gigantamax via a `NOT_GIGANTAMAX_SQL` LIKE-pattern mirroring
  `isGigantamaxForm`; new `gigantamaxCompleteLens`) and
  `src/data/in-memory-store.ts` (`computeLens`'s `formComplete`/new
  `gigantamaxComplete` branches, reading the same setting key — exported from
  `src/data/repository.ts` alongside `MAX_GRID_INDICATORS` since both
  backends and Settings need it). Verified against real reference data
  (throwaway script, not committed): Venusaur's Form-complete now clears
  once both Standard forms are caught without needing its Gigantamax form;
  Tauros's Form-complete stays incomplete by default with a
  regional-exclusive form uncaught, and clears once the new toggle is
  flipped on.
