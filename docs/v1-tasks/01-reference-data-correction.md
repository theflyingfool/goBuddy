*Part of the [V1 Task Breakdown](README.md). Previous: [0. Already decided](00-context.md). Next: [2. Data-safety net](02-data-safety-net.md).*
*Roadmap context: [Theme 2 — Reference-data corrections](../v1-roadmap/02-reference-data-corrections.md).*

## 1. Reference-data correction pass

*Do this before any real device holds personal data — slugs are immutable by
design, so fixes here are free today and permanent debt later.*

- [x] Fix Necrozma fusion names: swap "Dawn Mane"/"Dusk Wings" → **Dusk Mane**
  (Solgaleo fusion) / **Dawn Wings** (Lunala fusion). `scripts/ingest/build-reference.ts`
  or the Forms CSV source, wherever the name string originates.
- [x] Purge phantom "Standard" form rows for: Deoxys, Giratina, Shaymin,
  Zygarde, Hoopa, Genesect, Basculin, Oricorio, Sinistea, Urshifu, Enamorus,
  Furfrou, Vivillon, Maushold, Dudunsparce. Extend `NO_STANDARD_FORM_NAMES` in
  `scripts/ingest/pokemon-facts.ts` (same mechanism already used for Unown).
  **Migrate the `shiny_available`/shiny-personal flag from the phantom row to
  the real default form** as part of the same change — verify per species.
  Done: for the 11 species with one clear default sub-row (Deoxys' "Normal",
  Furfrou's "Natural", ...) the phantom's Shiny flag moved to that row. For
  Basculin, Oricorio, and Vivillon — no single default among their color/
  pattern variants — the flag was conservatively copied onto every variant
  rather than picking one arbitrarily; still worth a manual per-form Shiny
  pass later (see the comment above `NO_STANDARD_FORM_NAMES`).
- [x] Fix gen-9 slug/name typos: `ogrepon`→`ogerpon`, `fezanipiti`→`fezandipiti`,
  `sinistchai`→`sinistcha` **and its dex number 1012→1013** (currently
  duplicates Poltchageist). Display-name fix: "Pharoah"→"Pharaoh" (Furfrou).
- [x] Add Crowned Sword Zacian / Crowned Shield Zamazenta forms (in GO since
  GO Fest 2025). Shiny available on both (owner-confirmed); Shadow/Dynamax
  left at the species' existing (unavailable) values pending confirmation.
- [x] Add the six missing `mega_variant` rows: Mega Pidgeot, Mega Kangaskhan,
  Mega Mewtwo X, Mega Mewtwo Y, Primal Kyogre, Primal Groudon. Note: current
  data has **zero** Mewtwo mega rows and `species.canMegaEvolve: false` for
  Mewtwo — fix `can_mega_evolve` too, not just add the variant rows.
- [ ] Tighten Gigantamax availability/shiny-availability gating to GO's actual
  rollout (all 32 canonical G-max species are currently marked available,
  shiny included — GO's rollout since late 2024 is a subset).
  **Deliberately deferred**: owner doesn't have the current rollout list
  handy; okay leaving all 32 marked available for now. Revisit when that
  list is available.
- [ ] Correct the "Mega Dimension" documentation error: it's official *Legends:
  Z-A* DLC, not fan content (fix the claim in `TODO.md`/ingestion comments).
  Re-verify the Uxie/Mesprit/Azelf/Malamar/Falinks "bogus mega-capable" flags
  against the official Z-A mega list before "correcting" them — they may be
  the tracker being *ahead* of the pipeline. Fix the false "Audino has no
  official Mega" claim (Mega Audino is ORAS-era and already in the data).
  **Deliberately deferred**: owner doesn't have an official Z-A mega list
  handy either. Note this is more than a doc fix — `build-reference.ts`'s
  mega-variety filter (only accepts PokeAPI `version_group` `x-y`/
  `omega-ruby-alpha-sapphire`, rejecting `mega-dimension` as "fan content")
  may be silently excluding real Z-A megas for Uxie/Mesprit/Azelf/Malamar/
  Falinks right now — needs the real list before touching that filter.
- [ ] **D7**: confirm the ~11 costume code identifications against Bulbapedia
  sprite images before slugging (Cap Pikachu O=Original/W=World; Flying
  Pikachu Fly/Fly5/FlyOkinawa/FlyGreen/FlyPurple/FlyOrange/FlyRed — see
  `docs/v1-roadmap/02-reference-data-corrections.md` §7 for the proposed names). Apply once confirmed.
- [x] Fix the lucky-IV-floor comment in `docs/data-model.md` (~10/10/10 →
  12/12/12; non-load-bearing, just a stale comment). Done as part of the
  docs reorg pass.
- [x] Once [§ 9](06-performance-and-quality-infra.md)'s slug-stability check
  script exists, run it against this pass's output before merging, to
  confirm nothing was accidentally renamed instead of corrected-in-place.
  The script was built in §2 (`scripts/ingest/check-slug-stability.ts`,
  not yet merged at the time of this pass) — ran it manually against this
  branch's diff from `master`: all 28 disappeared form slugs and 3
  disappeared species slugs match this pass's documented, intentional
  renames/purges above, nothing unaccounted for.
- [x] **New, found via owner's manual `ingest:csv:export` review**: Armored
  Mewtwo was double-modeled — once correctly as a real Forme
  (`mewtwo-armored-unknown`, from the Forms-CSV/PokeAPI pipeline) and again
  as a costume on the Standard form (`mewtwo-standard-armored-mewtwo-unknown`,
  from `parse-event-pokemon.ts`'s Bulbapedia scrape, which doesn't
  distinguish genuine alternate Formes from real costumes in Bulbapedia's
  "Event Pokémon (GO)" list). Added a `NOT_ACTUALLY_A_COSTUME` exclusion set
  (same pattern as `NO_STANDARD_FORM_NAMES`) to prevent recurrence, and
  manually removed the already-imported duplicate form + its `formTypes` row
  from `reference.json` (the CSV import path only inserts/updates, never
  deletes). Checked for the same pattern elsewhere first — Pumpkaboo/
  Gourgeist's "Spooky Festival (Small/Average/Large)" looked similar but is
  legitimate (a real costume applied per size variant, already a documented
  known case in `parse-event-pokemon.ts`). Owner is continuing a manual
  review of the Coverage Report for further issues; more may follow.
- [x] **Follow-up systematic scan** (dex-number/slug duplicate check,
  referential-integrity check across all reference tables, a full read of
  every remaining `possible-bogus-form`/`missing-types`/`unverified-gender`
  gap): found and fixed 4 more real bugs, all confirmed against the cached
  PokeAPI varieties before changing anything:
  - **Grimer/Muk**: the tracker CSV mislabeled their real Alolan regional
    variant as "Galarian" (PokeAPI only has `grimer-alola`/`muk-alola`, no
    Galar variety) — both species were missing their real Alolan form
    entirely while carrying a fake Galarian one. Renamed in the Forms CSV;
    types now correctly resolve to Poison/Dark.
  - **Slowking**: same mislabeling in reverse — tracker said "Paldean"
    (doesn't exist for Slowking) instead of "Galarian" (real, evolves from
    Galarian Slowpoke; PokeAPI only has `slowking-galar`). Renamed; types
    now correctly resolve to Poison/Psychic.
  - **Persian**: had a "Galarian" sub-row with no valid basis at all —
    Persian's only real regional variant is Alolan (already correctly
    present separately; PokeAPI has only `persian-alola`). Deleted the
    bogus row.
  - **Tauros**: Paldean breed forms were tagged `Paldean(Fight)`/`(Water)`/
    `(Fire)`, but PokeAPI's real variety names use `combat`/`aqua`/`blaze`
    — the lexical mismatch meant none of the three matched, so all three
    silently fell back to base Tauros's Normal type instead of their real
    Fighting/Fighting-Water/Fighting-Fire types. Renamed to
    `Paldean(Combat)`/`(Aqua)`/`(Blaze)` (the actual in-game breed names),
    which let the existing breed-matching logic resolve them correctly
    with no code change.
  - Ran the slug-stability script again afterward: all 11 disappeared form
    slugs from this round match these fixes exactly, nothing unaccounted
    for.
  - Confirmed **not** bugs: Unown's 28 letters show as `missing-types` too,
    but Unown is genuinely pure Psychic regardless of letter, so the
    placeholder fallback happens to already be correct — cosmetic
    gap-tracking noise, not a real issue.
  - Still open, deliberately untouched (same "no official Z-A mega list"
    deferral as before): the `possible-bogus-form` mega-capable flags for
    Butterfree, Victreebel, Dragonite, Lugia, Uxie, Mesprit, Azelf,
    Malamar, Falinks.
