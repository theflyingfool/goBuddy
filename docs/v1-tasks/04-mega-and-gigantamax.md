*Part of the [V1 Task Breakdown](README.md). Previous: [3–4. Visual identity & legibility](03-visual-and-legibility.md). Next: [7. Image pipeline](05-image-pipeline.md).*
*Roadmap context: [Theme 3 — Feature rescoping](../v1-roadmap/03-feature-rescoping.md).*

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
