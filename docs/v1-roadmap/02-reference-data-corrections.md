*Part of the [V1 Roadmap](README.md). Previous: [Theme 1 — Data safety](01-data-safety.md). Next: [Theme 3 — Feature rescoping](03-feature-rescoping.md).*

## Theme 2 — Reference-data corrections: do these *before* first real install

Slugs are permanent by design — fixing a wrong slug after real personal data
exists means a slug-rename registry entry forever. Fixing them now is free.
The domain reviewer verified time-sensitive game facts by web search.

**Ship-stopping (all S–M, mostly ingestion-script work):**

1. **Necrozma's fusion names are swapped**: the data says "Dawn Mane" / "Dusk
   Wings"; the real forms are **Dusk Mane** (Solgaleo fusion) and **Dawn
   Wings** (Lunala fusion). Both are in GO. The single most embarrassing string
   in the dataset for a serious player.
2. **Phantom "Standard" forms on ~15 multi-form species.** The Unown fix
   (species-header row isn't a real form) needs extending to at least: Deoxys,
   Giratina, Shaymin, Zygarde, Hoopa, Genesect, Basculin, Oricorio, Sinistea,
   Urshifu, Enamorus, Furfrou, Vivillon, Maushold, Dudunsparce. Each phantom
   inflates the Form-complete denominator (the count a percentage is measured
   against) and shows a catchable that doesn't exist ("Giratina has 3 forms").
   Note: the shiny flag often sits on the phantom row — it must migrate to the
   real default form when the phantom is removed. Mechanism already exists:
   `NO_STANDARD_FORM_NAMES` in `scripts/ingest/pokemon-facts.ts`.
3. **Gen-9 slug typos + one wrong dex number**: `ogrepon` → Ogerpon,
   `fezanipiti` → Fezandipiti, `sinistchai` → Sinistcha **at dex 1013, not
   1012** (it currently duplicates Poltchageist's number). Also "Pharoah" →
   "Pharaoh" (display name).
4. **Crowned Sword Zacian / Crowned Shield Zamazenta are missing** — in GO
   since GO Fest 2025, two of the most chased entries in the current game.
5. **Six megas missing that ARE in GO**: Mega Pidgeot, Mega Kangaskhan, Mega
   Mewtwo X, Mega Mewtwo Y, Primal Kyogre, Primal Groudon. TODO.md already
   suspected five as "stale tracker data"; the domain review confirms all six.
   The Mega dex lens is wrong by 6/50 until fixed — and this must land before
   the Mega tracking UI makes it visible.

**Correct the project's own records (V1-nice but do it while it's fresh):**

6. **"Mega Dimension" is not fan content.** TODO.md's ingestion notes call
   PokeAPI's Mega Dimension data "a non-canonical fan-content pack." It is the
   **official DLC of Pokémon Legends: Z-A** (~21 new official megas, plus more
   in the base game). Consequences: the tracker's "bogus mega-capable" flags
   for Uxie/Mesprit/Azelf/Malamar/Falinks are likely the tracker being *ahead*
   of the pipeline, not copy-paste errors (verify against Serebii's Z-A list
   before "correcting" them); and TODO.md's claim that Audino has "no official
   Mega" is flatly wrong (Mega Audino is ORAS-era; `audino-mega` is even in the
   data already). The x-y/ORAS version-group filter is still *defensible* for
   "what's in GO today" — but document it as an availability filter, not a
   fake-data filter, and plan its removal for when Z-A megas reach GO.
7. **The ~11 unresolved costume codes — identified.** Cap Pikachu `O` =
   Original Cap, `W` = World Cap (high confidence; other letters follow
   Bulbapedia's Hoenn/Sinnoh/Unova/Kalos/Alola/Partner scheme). `Fly` = Flying
   Pikachu, yellow balloons (4th anniversary 2020); `Fly5` = "5"-shaped
   balloons (5th anniversary 2021); `FlyOkinawa` = Okinawa tourism promo
   (2022); `FlyGreen/Purple/Orange/Red` = balloon-color variants from the
   5th-anniversary era (the *what* is certain, exact per-color event
   attribution is medium confidence). Suggested display: "Flying (5th
   Anniversary)", "Flying (Okinawa)", etc. Confirm against Bulbapedia's sprite
   images before committing — these become immutable slugs.
8. Minor: the lucky-IV floor comment in `docs/data-model.md` says "~10/10/10";
   it's actually 12/12/12 (non-load-bearing, fix the comment).
