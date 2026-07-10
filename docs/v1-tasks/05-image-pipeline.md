*Part of the [V1 Task Breakdown](README.md). Previous: [5–6. Mega & Gigantamax](04-mega-and-gigantamax.md). Next: [8–9. Performance & quality infra](06-performance-and-quality-infra.md).*
*Roadmap context: [Addendum, point 3](../v1-roadmap/addendum.md).*

## 7. Image pipeline (new, expanded scope)

*The image folder is a git checkout of `PokeMiners/pogo_assets` at
`Refs from Obsidian/pogo_assets/Images/Pokemon - 256x256`. **Revised approach**
(found while starting this section): the plain numeric-ID icon set this
section originally pointed at (2,213 PNGs, dex 1–867) has a much better
sibling — `Addressable Assets/`, 3,727 PNGs named like
`pm100.fHISUIAN.icon.png` / `pm133.cHOLIDAY_2022.icon.png`, covering dex up to
1019, with **human-readable form/costume codenames instead of opaque numeric
IDs**. That sidesteps the original "source the game-master's numeric ID enum"
blocker entirely — codenames still need a name translation (see below), but
that's a much smaller/self-contained problem.*

- [x] Species-level art swap: `scripts/ingest/build-sprite-mapping.ts`
  (`npm run ingest:sprites`) copies every base `pm{dex}.icon.png` (+ `.s.` shiny
  variant) into `public/sprites/{dex:3}[-shiny].png`, replacing the old
  801-species set — 953 distinct species now covered (up from 809), through
  dex 1019, with 66 gaps where PokeMiners itself has no base icon yet (listed
  in `forms-missing-images.csv`, see below). Verified species identity by
  eye — Read-rendered Pikachu (025), Charizard (006), Rayquaza (384), and
  Poltchageist (1013, a very new gen-9 species) and confirmed each is the
  right creature, not just a plausible-looking file.
- [x] Regional forms + Gigantamax: the same script auto-matches a small,
  deliberately conservative whitelist of unambiguous form codenames (`ALOLA`,
  `GALARIAN`, `HISUIAN`, `PALDEA`, `PALDEA_COMBAT`, `PALDEA_AQUA`,
  `PALDEA_BLAZE`, `GIGANTAMAX`) against `reference.json`'s `form_name`,
  copying matches into `public/sprites/forms/{form.slug}[-shiny].png` (230
  distinct form slugs matched this way so far, up from 102 — `GIGANTAMAX`
  alone added all 17 Gigantamax-capable species PokeMiners has art for, each
  cleanly resolving to the single `formName` `"Gigantamax"`). Verified
  Galarian Articuno and Paldean Blaze Breed Tauros by eye. **Deliberately
  not auto-matched**: any single-letter form token (Unown's A–Z collide with
  Mewtwo's "A" = Armored — confirmed by inspecting the actual files, not
  assumed).
- [x] Mega/Primal: matched separately from regular forms, since Mega is its
  own reference table (`megaVariants`, not `forms` — per this project's
  own design note that not every future fact is per-form/per-species
  boolean). `MEGA`/`MEGA_X`/`MEGA_Y`/`PRIMAL` tokens are looked up against
  `(speciesSlug, variant)` and copied to `public/sprites/mega/{mega.slug}
  [-shiny].png`, tracked in a new manifest (`src/data/mega-sprite-slugs.json`)
  and a new `megaSpritePath()` helper in `src/ui/sprites.ts`. All 57 mega
  variants in `reference.json` got matching art (114 files incl. shiny) —
  verified Mega Charizard X and Mega Raichu X by eye.
  **Also fixed a real `reference.json` bug found via this pass**: six
  species initially looked like non-canon "concept mega" fan content
  (Dragonite, Skarmory, Raichu X/Y, Malamar, Victreebel, Falinks) but the
  owner confirmed all six are real, current Mega Evolutions in GO. Root
  cause: `build-reference.ts` only trusted a PokeAPI mega variety if it
  belonged to a mainline version_group (`x-y`/`omega-ruby-alpha-sapphire`)
  — structurally impossible for any GO-exclusive Mega release, since
  PokeAPI mirrors the mainline games, not GO's own schedule. Fixed
  `build-reference.ts` to trust the GO tracker CSV's Mega column for
  availability, using PokeAPI's variety list only to determine variant
  shape (plain/X/Y/Primal); also corrected two stale tracker cells (Raichu,
  Skarmory were marked unavailable despite having real art) and confirmed 5
  *other* newly-surfaced rows (Butterfree, Lugia, Uxie, Mesprit, Azelf) were
  genuinely bogus tracker entries — no art exists for any of them — and
  marked those unavailable rather than shipping them. Ran the full
  ingestion order (`docs/ingestion-runbook.md`) and `ingest:check-slugs`
  passed clean.
- [x] Gender-tagged (`.g`) files: owner confirmed the convention — `.g2` is
  always "female", and there is no `.g1` anywhere in the dump (independently
  verified: every gender-tagged file in all 3,631 icons is `.g2`; the
  untagged file already serves as "male"). The script now resolves these
  instead of hand-checking them: files are processed male-first (untagged,
  then `.g2`, via a stable sort) so a `.g2` match can correct a slug the
  male-first pass provisionally filled with the male art, without needing to
  hold state across two lookups. This covers three cases: a bare Standard-
  form gender file (e.g. Rhyhorn), a costume + gender combo, and a whitelisted
  form + gender combo. Verified Rhyhorn's `-female` sprite by eye and by hash
  (distinct file from the male/base sprite, not a duplicate).
- [x] Costume name translation: `scripts/ingest/costume-lookup.json`
  (committed) maps a costume codename (e.g. `HOLIDAY_2022`) to this app's
  existing `costume_name` display string (e.g. `"Festive hat"`) — these
  don't textually match so can't be auto-derived. The script consults this
  file and auto-matches/copies once an entry exists; re-running after
  adding entries only surfaces genuinely-new codenames going forward (the
  "only ever check new things" loop). One real entry so far
  (`JAN_2020_NOEVOLVE` -> `"Party hat (red)"`, owner-confirmed from the
  actual art — cleared this costume for every species that has it, not just
  the one it was confirmed on) — owner is hand-filling the rest from the
  CSV below.
- [x] Hand-check deliverables, written next to a scratch copy of the actual
  files in `Refs from Obsidian/image-pipeline-staging/` (uncommitted —
  that whole directory is outside the git repo, per the owner's call):
  `extra-images.csv` (1,256 files, down from the original 1,686 now that
  Mega/Gigantamax/gender/Unown are resolved — remaining reasons are almost
  all "form token not in the confident-match whitelist" (e.g. Deoxys/Rotom/
  Burmy multiforms) and "costume codename not yet in costume-lookup.json",
  plus 4 unmatched dex numbers) and `forms-missing-images.csv` (148 forms
  with genuinely zero art anywhere in the dump — distinct from "extra,"
  which is "a file exists but wasn't confidently assigned").
- [ ] Cross-referencing into `form.imageRef`/`build-reference.ts` — not done;
  the sprite-slug manifest (`src/data/form-sprite-slugs.json`, below) served
  the same "does this form have art" purpose without needing this yet. Revisit
  once costume-lookup.json has real entries and the extra-images backlog
  shrinks.
- [x] `formSpritePath()`/`megaSpritePath()` added to `src/ui/sprites.ts`,
  both falling back to `speciesSpritePath()` via their own committed
  manifests (`src/data/form-sprite-slugs.json` and
  `src/data/mega-sprite-slugs.json`, both regenerated by the ingest script)
  of which slugs actually have art — checking `public/`'s filesystem at
  runtime isn't possible for a bundled static folder.
- [x] Wired `src/features/data-entry/species-detail.ts` (hero + form tiles +
  each Mega variant row) and `src/features/data-entry/bulk-form-edit.ts`
  (form tiles) to prefer per-form/per-mega art via `formSpritePath()`/
  `megaSpritePath()`. `species-grid.ts` intentionally left on
  `speciesSpritePath()` — its tiles are one per species, not per form, so
  there's no per-form context to prefer there.
- [x] Shiny view toggle: species-detail gets a small "✨" button on the hero
  sprite (view-only, independent of the caught-shiny achievement field — the
  point is being able to look at shiny art regardless of whether you've
  actually caught one) that flips both the hero and every form-tile sprite
  on that page to their `-shiny` variant. **Not visually verified** — no
  browser in this environment; on-device review needed before considering
  this actually done.
