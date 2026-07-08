*Part of the [V1 Task Breakdown](README.md). Previous: [0. Already decided](00-context.md). Next: [2. Data-safety net](02-data-safety-net.md).*
*Roadmap context: [Theme 2 — Reference-data corrections](../v1-roadmap/02-reference-data-corrections.md).*

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
  `docs/v1-roadmap/02-reference-data-corrections.md` §7 for the proposed names). Apply once confirmed.
- [ ] Fix the lucky-IV-floor comment in `docs/data-model.md` (~10/10/10 →
  12/12/12; non-load-bearing, just a stale comment).
- [ ] Once § 9's slug-stability check script exists, run it against this pass's
  output before merging, to confirm nothing was accidentally renamed instead
  of corrected-in-place.
