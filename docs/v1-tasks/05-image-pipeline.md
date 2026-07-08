*Part of the [V1 Task Breakdown](README.md). Previous: [5–6. Mega & Gigantamax](04-mega-and-gigantamax.md). Next: [8–9. Performance & quality infra](06-performance-and-quality-infra.md).*
*Roadmap context: [Addendum, point 3](../v1-roadmap/addendum.md).*

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
