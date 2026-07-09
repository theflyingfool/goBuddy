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

- [ ] Hide the redundant Dynamax/Lucky-Dynamax toggle groups on Gigantamax
  form rows (they carry `dynamaxAvailable: true` today, showing groups that
  describe the same catch event as the G-max row's own Standard branch) — use
  the existing `availableWhen` mechanism in `src/features/data-entry/field-groups.ts`.
- [ ] **D2**: decide form-complete denominator — exclude regional-exclusive
  forms from the default lens (they currently make form-complete unattainable
  for region-locked species); consider a separate "G-max-complete" lens.
- [ ] Implement the chosen denominator logic
  (`src/data/completion-stats-sql.ts` ~line 65).
