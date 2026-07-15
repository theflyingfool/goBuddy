# Costume-lookup.json verification log

Tracks every [`costume-lookup.json`](../scripts/ingest/costume-lookup.json) entry filled in by an
automated first pass (image inspection + cross-referencing `reference.json`'s
existing `costumeName` strings), split by confidence — so a human check only
has to look at what's actually uncertain instead of re-deriving all of it.
Update this file as entries get confirmed, corrected, or resolved.

Companion to [features.md#4-sprite-asset-pipeline](features.md#4-sprite-asset-pipeline) §4.

## How to read this

- **High confidence** — filled in, and the reasoning is solid enough that a
  glance at the in-app art after the next `ingest:sprites` run should be
  enough to confirm. Low risk either way: a wrong entry only means the
  species doesn't resolve (stays in `extra-images.csv`), not that it gets
  the wrong art, since the lookup is exact-string-match per species.
- **Medium confidence** — filled in, but the match is inferred (e.g. from
  color/character association) rather than a direct textual or unique-option
  confirmation. Worth a real look.
- **Left blank / blocked** — nothing written to the JSON. Either the real
  costume isn't in `reference.json` at all yet (a data gap, not a lookup
  problem), or the codename splits across multiple different real costumes
  and can't be resolved with one value, or a script limitation (see below)
  is blocking it regardless of what the lookup says.

---

## Batch 1 (first 11 tokens, alphabetical)

### High confidence

| Codename | Value written | Evidence |
|---|---|---|
| `ANNIVERSARY` | `Party hat` | Pichu/Pikachu/Raichu all wear the same purple/teal cone hat in the actual art; Pichu and Raichu each only have this one costume option in `reference.json`, so there's nothing else it could be. |
| `ANNIVERSARY_2022_NOEVOLVE` | `Cake costume` | Pikachu wearing a birthday-cake-shaped hat with a bow tie. |
| `APRIL_2020_NOEVOLVE` | `Flower crown` | Togepi/Togetic/Buneary/Lopunny/Togekiss all share exactly this one costume option and the art shows a flower crown. |
| `FALL_2020_NOEVOLVE` | `Fashionable costume` | Smoochum/Kirlia/Shinx/Croagunk/Toxicroak all share exactly this one option; art shows a stylish wig/bow look. |
| `FALL_2022_NOEVOLVE` | `Cempasúchil crown` | Duskull/Dusclops/Dusknoir wearing an orange marigold crown (Día de los Muertos). **Partial**: Absol and Gengar also carry this codename but have a different real costume ("Fashionable costume") — safe to leave unresolved, not a wrong match. |
| `FALL_2023` | `Cempasúchil crown` | Same crown, on Cubone/Marowak a year later. **Partial**: Dragonite/Wooper/Quagsire also carry this codename with a different real costume ("Fashionable costume") — same safe-partial situation as above. |

### Left blank / blocked

| Codename | Species affected | Why it's blocked |
|---|---|---|
| `ANNIVERSARY_2024` | Grimer, Muk | Red-and-white party hat, but it's visually distinct from their existing "Party hat (red)" (that one's solid red). Looks like a genuinely new costume not yet in `reference.json` — needs a new form row added, not just a lookup entry. |
| `COSTUME_1` | Pikachu, Raichu | Red cap with a small dark logo. Pikachu has "Cap Pikachu (O)" and "Cap Pikachu (W)"; Pichu only has generic "Cap Pikachu" and has no file for this codename at all, which points at `COSTUME_1` being one of the two Pikachu/Raichu-specific variants — can't tell O from W by eye alone. |
| `COSTUME_2` | Pichu, Pikachu, Raichu | Purple top hat. Best guess is "Party top hat," but that name only exists in **Pikachu's** costume list in `reference.json` — Pichu and Raichu don't have it listed at all despite having the file. Possible `reference.json` data gap for Pichu/Raichu. |
| `FALL_2018` | Pichu, Pikachu, Raichu | Black cap with a small white logo. Nothing in Pikachu's costume list was a confident match. |
| `FALL_2022` | Vulpix/Ninetales, Diglett/Dugtrio, Pumpkaboo/Gourgeist | Splits three ways: Vulpix/Ninetales get "Spooky Festival" (colorful bandana), Diglett/Dugtrio get "Fashionable costume" (bowler hat), Pumpkaboo/Gourgeist need a size-specific "Spooky Festival (Small/Average/Large/Super)" — see **script limitation** below. |

---

## Batch 2 (next 10 tokens, alphabetical)

### High confidence

| Codename | Value written | Evidence |
|---|---|---|
| `FALL_2023_NOEVOLVE` | `Mega Banette costume` | Gengar wearing a headpiece with Banette's signature pointy-ear/stitched-mouth silhouette. **Partial**: Pikachu also carries this codename (a festive robe/hat, doesn't match anything in Pikachu's own costume list) — left unresolved for Pikachu, doesn't affect Gengar. |
| `FALL_2024` | `Halloween costume` | Froakie/Frogadier/Greninja/Rowlet/Dartrix/Decidueye all share exactly this one option; art shows a witch hat. |
| `FASHION_2021_NOEVOLVE` | `Fashionable costume` | Butterfree/Sneasel/Blitzle all share exactly this one option; art shows a scarf + sunglasses look. |
| `FASHION_2025` | `Fashionable costume` | Minccino/Cinccino share exactly this one option; art shows glasses + bow ribbons. |
| `FEB_2019` | `Detective Pikachu` | Pikachu (and Raichu) wearing the brown deerstalker hat from the 2019 movie tie-in — unmistakable. |
| `GOFEST_2021_NOEVOLVE` | `Meloetta hat` | Gardevoir's art shows a small green/white cap matching Meloetta's color scheme; Zigzagoon/Flygon/Pikachu all also have this as their (Zigzagoon: Galarian-form-only, see script limitation) shared option. |

### Medium confidence

| Codename | Value written | Evidence | Why only medium |
|---|---|---|---|
| `GEMS_1_2021_NOEVOLVE` | `Lucas's hat` | Turtwig wearing a red beanie with a green leaf sprout. | Turtwig/Chimchar/Piplup's only two costume options are "Lucas's hat" and "Dawn's hat" — narrowed to 2, then assigned by character color association (Lucas = red/orange in-game), not a direct textual confirmation. |
| `GEMS_2_2021_NOEVOLVE` | `Dawn's hat` | Turtwig wearing a white/cream beanie with the same leaf sprout. | Same reasoning as above, inverted (Dawn = white/pink in-game). |
| `GOFEST_2022_NOEVOLVE` | `Cowboy hat` | Snorlax wearing a brown cowboy-style hat, matching one of its three costume options ("Cowboy hat", "Nightcap", "Studded Jacket"). | Confident for Snorlax specifically (unambiguous once you see the hat), but Pikachu also carries this codename with an unrelated subtle floral accessory that doesn't match anything obvious in Pikachu's list — left unresolved for Pikachu. |

### Left blank / blocked (at the time — see Batch 4, now resolved)

| Codename | Species affected | Why it's blocked |
|---|---|---|
| `GOTOUR_2023_BANDANA` | Pikachu | Red/black/white striped bandana. Checked every costumeName in the entire `reference.json` for anything containing "bandana" or "tour" — nothing exists (the real name doesn't contain either word, see Batch 4). |

---

## Cross-cutting: a real script limitation, not a lookup problem

Several files carry **both** a form token and a costume token together, e.g.:

- `pm710.fAVERAGE.cFALL_2022.icon.png` (Pumpkaboo, size + costume)
- `pm77.fGALARIAN.cGOFEST_2021_NOEVOLVE.icon.png` (Galarian Ponyta + costume)
- `pm263.fGALARIAN.cGOFEST_2021_NOEVOLVE.icon.png` (Galarian Zigzagoon + costume)

`scripts/ingest/build-sprite-mapping.ts`'s costume-matching branch only ever
looks up `(speciesSlug, costumeName)` — it doesn't currently consider the
form token at all when both are present on the same file. For species like
Pumpkaboo where the "size" is modeled as part of `costumeName` (e.g.
`"Spooky Festival (Small)"`) rather than `formName`, no value in
`costume-lookup.json` can make this resolve — still flagged as blocked, see
below for what part of this **was** fixed.

**Update — this wasn't just a "safe, under-resolves" situation.** Filling in
`GOFEST_2021_NOEVOLVE -> "Meloetta hat"` this batch actually exercised the
bug for real: Galarian Ponyta's and Galarian Zigzagoon's `fGALARIAN.cGOFEST_
2021_NOEVOLVE` files got matched purely on `(species, costumeName)`, with no
check that the matched `form.slug` was also the Galarian one — and
`reference.json` only has a `"Standard"`-formName row for this costume for
both species. The Galarian-colored art (visually confirmed: Galarian
Ponyta's white/purple palette, Galarian Zigzagoon's black/white palette) was
getting copied to the **`-standard-`** slug, i.e. mislabeled as the
non-Galarian form's art.

**Fixed** in `build-sprite-mapping.ts`: when a file carries both a costume
token and a form token, the costume match now also requires the form's
`formName` to equal the form token's whitelisted translation; if the form
token isn't whitelisted at all, it's routed to `extra-images.csv` instead of
guessing. Pumpkaboo/Gourgeist sizes remain genuinely blocked (their "size"
isn't a `formName` at all, so no translation exists to check against) — that
part of the limitation stands.

**Also fixed while investigating**: `ingest:sprites` was never clearing
`public/sprites/{, forms/, mega/}` between runs (only the scratch/CSV dir got
this treatment) — so the two mislabeled files above would have silently
survived even after the matching-logic fix, since nothing in the new run
would have overwritten those exact paths. Now every generated output dir is
wholesale-replaced each run, same as the reference-data principle in
CLAUDE.md. This also retroactively exposed **32 species** whose
`public/sprites/{dex}.png` was actually a stale leftover from the pre-
PokeMiners (Obsidian-vault) sprite set — PokeMiners has no plain base icon
for any of them, but the old file had never been cleaned up across every
`ingest:sprites` run since the swap, so they'd been silently showing
old-style art this whole time instead of the documented gap. 24 of the 32
were already listed in `forms-missing-images.csv`; **8 were not**, because
that report's "missing base icon" check only ever looks at forms literally
named `"Standard"` — species whose forms are *all* non-Standard-named
(Vivillon's patterns, Genesect's drives, Basculin's colors, Furfrou's
trims, Zygarde's formes, Oricorio's styles, plus Unown, already known)
never hit that check at all. Not fixed in this pass (a real second gap in
the missing-report's own logic, separate from the costume work) — flagged
here rather than silently left to look like a regression.

**Separately, unrelated to costumes**: while checking those 8, found that
**Espurr (dex #677) has no species row in `reference.json` at all** — the
only missing dex number anywhere in 1–1025. `pm677.icon.png` exists fine in
the PokeMiners dump. Root-caused and fixed — see "Espurr fix" below.

---

## Batch 3 (all remaining tokens)

Every token that had a species with exactly one costume option resolved
automatically (that species can't be anything else); tokens spanning
multiple species with a shared unique option resolved the same way. Only
the genuinely ambiguous ones got a visual check.

### High confidence

| Codename | Value written | Evidence |
|---|---|---|
| `HALLOWEEN_2017` | `Witch hat` | Raichu wearing a purple witch hat, unmistakable. |
| `HALLOWEEN_2021_NOEVOLVE` | `Halloween Mischief` | Drifblim's only costume option. |
| `HOENN_2020_NOEVOLVE` | `Rayquaza hat` | Pikachu wearing a green/teal Rayquaza-head hat — Rayquaza is Hoenn's box legendary. Confirmed male and female files show the same costume, just different Pikachu render. |
| `HOLIDAY_2016` | `Festive hat` | Raichu wearing the classic red/white Santa-style hat. |
| `HOLIDAY_2023` | `Holiday outfit` | Golduck's only option. |
| `HORIZONS_2025_NOEVOLVE` | `Hat with Liko's pin` | Floragato's only option — Liko is the protagonist of the current Pokémon Horizons anime, ties in with the codename's "HORIZONS" directly. |
| `INDONESIA_2025_NOEVOLVE` | `Indonesia Football Jersey` | Pikachu in a red jersey with a shield crest — direct match. |
| `JAN_2022_NOEVOLVE` | `New Year's outfit` | Hoothoot/Noctowl's shared-and-only option. |
| `JAN_2023_NOEVOLVE` | `New Year's hat` | Pikachu wearing a dark hat with stars — festive/New Year look, January fits. |
| `JAN_2024` | `Ribbon` | Jigglypuff/Wigglytuff's shared-and-only option. |
| `JOHTO_2020_NOEVOLVE` | `Umbreon hat` | Pikachu wearing a dark hat with yellow rings matching Umbreon — an iconic Johto-region Pokémon. |
| `KANTO_2020_NOEVOLVE` | `Charizard hat` | Pikachu wearing an orange hat matching Charizard — Kanto's mascot starter-evolution. |
| `MAY_2019_NOEVOLVE` | `Straw hat` | Pikachu wearing a straw hat with a red band, direct match. |
| `MAY_2023` | `Cherry blossoms` | The 8 non-Eevee eeveelutions' shared white/petal collar-style accessory — one of only 4 costumes they all have; visually a flower/petal collar, fits "Cherry blossoms" best of the 4. |
| `May_2023` (odd casing, one file only) | `Explorer hat` | Eevee wearing a distinct cream/tan safari-style cap — visually confirmed **different** from `MAY_2023`'s collar, so these two near-identical codenames really are two different real costumes, not a typo of each other. |
| `NIGHTCAP` | `Nightcap` | Direct textual match — one of Snorlax's three options. |
| `NOVEMBER_2018` | `Flower crown` | Chansey (and Blissey/Happiny)'s only option; image shows literal small flowers on the head. |
| `PI` | `Detective Pikachu` | Raichu wearing the same brown deerstalker hat as `FEB_2019` — "PI" = Private Investigator, a fitting second wave reusing the same art. |
| `PI_NOEVOLVE` | `Hat` | Slowpoke wearing a plain brown hat, not glasses — picks the right one of its two options. |
| `ROYAL_NOEVOLVE` | `Crown` | Nidoqueen/Nidoking's shared-and-only option — thematically obvious ("Royal" + "Crown"). |
| `SAFARI_2020_NOEVOLVE` | `Safari hat` | Pikachu wearing a khaki safari hat, direct match. |
| `SINNOH_2020_NOEVOLVE` | `Lucario hat` | Pikachu wearing a blue/black hat matching Lucario — debuted in Sinnoh. |
| `SPRING_2020_NOEVOLVE` | `Pikachu visor` | Bulbasaur with a tiny Pikachu perched on its head — unmistakable, direct name match. |
| `SPRING_2023` | `Flower crown` | Eevee wearing pink flowers on its head, direct visual match. |
| `SPRING_2023_INSTINCT` | `Spark-themed accessory` | Electabuzz/Elekid/Electivire's shared-and-only option — "INSTINCT" = Team Instinct, led by Spark. Strong semantic + textual fit. |
| `SPRING_2023_MYSTIC` | `Blanche-themed accessory` | Lapras's other option besides "Scarf" — "MYSTIC" = Team Mystic, led by Blanche. Same semantic pattern as Instinct/Valor. |
| `SPRING_2023_VALOR` | `Candela-themed accessory` | Rapidash's only option, and one of Ponyta's two — "VALOR" = Team Valor, led by Candela. Confirms the same three-team pattern (Instinct/Mystic/Valor all resolved by team-leader name). |
| `SPRING_2024` | `Flower crown` | Cottonee/Whimsicott's shared-and-only option. |
| `SUMMER_2018` | `Squirtle Squad sunglasses` | Squirtle wearing sunglasses, direct match. **Partial**: Pichu/Pikachu/Raichu also carry this codename but don't have this costume name at all (they likely got a different item, maybe "Summer-style" — unconfirmed) — safe to leave unresolved for them. |
| `SUMMER_2024` | `Visor` | Slakoth/Vigoroth/Slaking's shared-and-only option. |
| `TCG_2022_NOEVOLVE` | `Pokémon TCG hat` | Pikachu wearing a blue cap with a small Poké Ball-style emblem, direct name match. |
| `WINTER_2018` | `Holiday outfit` | Stantler's only option. |
| `WINTER_2024` | `Holiday Attire` | Dedenne/Wooloo/Dubwool's shared-and-only option. |

### Medium confidence

| Codename | Value written | Why only medium |
|---|---|---|
| `HALLOWEEN_2025` | `Witch hat` | Teddiursa/Ursaring/Ursaluna share this and it's visually confirmed (purple witch hat on Teddiursa). **Partial**: Noibat/Noivern also carry this codename but their own option is "Headband" — a different real costume, left unresolved rather than guessed. |
| `HOLIDAY_2021_NOEVOLVE` | `Holiday outfit` | Spheal's only option, confident for Spheal. **Partial**: Glaceon also carries this codename but doesn't have "Holiday outfit" in its list at all (it has "Holiday hat" instead) — different costume, left unresolved for Glaceon. |
| `HOLIDAY_2022` | `Holiday hat` | Eevee wearing a small red/green holiday-style cap — fits, but "Holiday hat" vs. the textually-similar "Holiday outfit" (used elsewhere) required a visual call rather than being obvious from text alone. |
| `ONE_YEAR_ANNIVERSARY` | `H.F. Custom Cap` | Raichu wearing a red/white/green cap. Picked mostly by elimination — it's the last unclaimed "cap"-sounding option in Raichu's list — not a confirmed meaning for what "H.F." stands for. **Also**: Mewtwo and Lugia carry this same codename but have **zero** costume options in `reference.json` at all (their art shows no visible costume either) — almost certainly non-canon/placeholder files, not a real costume; no value can make these resolve, and none should. |

### Left blank / blocked (at the time — see Batch 4, now resolved)

| Codename | Species affected | Why it's blocked |
|---|---|---|
| `GOTOUR_2023_BANDANA_NOEVOLVE` | Pikachu | Same red/black/white bandana as `GOTOUR_2023_BANDANA` (already blank) — confirmed visually identical. No matching costumeName exists anywhere in `reference.json` under "bandana" or "tour" (the real name doesn't contain either word, see Batch 4). |
| `GOTOUR_2023_HAT` | Pikachu | A white/black cap with a small red emblem. Nothing in Pikachu's list was a confident match from the image alone — closest guesses ("Captain Pikachu", "Rei's cap") weren't strongly supported enough to write down, and Pikachu has ~90 options where a wrong guess risks a real (if incorrect) match rather than a safe non-match. Resolved externally in Batch 4. |
| `GOTOUR_2023_HAT_NOEVOLVE` | Pikachu | Same cap as `GOTOUR_2023_HAT`, same uncertainty at the time. |

---

## Batch 4 (the last 3 blocked entries — resolved via web search)

The remaining GOTOUR_2023 tokens couldn't be pinned down from the image or
`reference.json` alone (their real costumeNames — "Brendan's hat", "May's
bow" — don't textually resemble "hat"/"bandana"/"tour" at all, so no amount
of re-guessing from the visual would have found them). Looked them up
externally instead of guessing further.

| Codename | Value written | Evidence |
|---|---|---|
| `GOTOUR_2023_HAT` | `Brendan's hat` | Web search found the exact PokeMiners-style codename "gotour-2023-hat" documented on a Pokémon GO stats site (Dittobase) as "Brendan's Hat Pikachu," from Pokémon GO Tour: Hoenn (2023, Las Vegas). Matches `reference.json`'s existing `"Brendan's hat"` costumeName exactly. |
| `GOTOUR_2023_HAT_NOEVOLVE` | `Brendan's hat` | Same costume as `GOTOUR_2023_HAT`, just the no-evolve file variant. |
| `GOTOUR_2023_BANDANA` | `May's bow` | Same source confirmed "gotour-2023-bandana" as "May's Bow Pikachu" — the Brendan/May pair released together at the start of that Hoenn tour, matching `reference.json`'s existing `"May's bow"` entry exactly. (This one wasn't in the "last 3" list — it had been sitting blank since Batch 1 for the same underlying reason, so fixed alongside the other three.) |
| `GOTOUR_2023_BANDANA_NOEVOLVE` | `May's bow` | Same costume as `GOTOUR_2023_BANDANA`, no-evolve variant. |

All 4 visually re-confirmed after re-running `ingest:sprites`: Pikachu's
Brendan's-hat and May's-bow sprites match what the PokeMiners files show.

**5 entries remain blank in `costume-lookup.json`**: `ANNIVERSARY_2024`
(Grimer/Muk costume not yet in `reference.json` at all), `COSTUME_1` /
`COSTUME_2` (Pikachu/Raichu/Pichu caps, genuinely ambiguous — see Batch 1),
and `FALL_2018` (black cap, no confident match found). `FALL_2022` also has
no single value that resolves it (splits across three different real
costumes by species) but isn't really "blank" so much as "can't be one
value" — see Batch 1.

---

## Espurr fix (dex #677)

Root cause found: `Blank Pokedex Project (Living Column) - Forms w_ Dynamax.csv`
had a **duplicated row label**. Furfrou's (dex 676) ten trim sub-rows are
correctly listed (Natural, Matron, Heart, Dandy, Star, La Reine, Diamond,
Kabuki, Debutante, Pharaoh — all ten real Furfrou trims, nothing missing
there), but the row immediately after them — which should have been
`"677 Espurr"` starting the next species — instead re-used the label
`"Pharaoh"` a second time, with every other column matching a species-row's
shape exactly (blank Shiny/Hundo/Lucky/XXL/XXS, dashed Mega/Dynamax/Shadow,
gen `7`). `parseFormsCsv`'s species-row regex requires a leading dex number,
so this line matched neither a species row nor a real Furfrou sub-row
correctly, and Espurr silently never got a row at all — not caught by
`ingest:check-slugs` since a species that never existed can't "vanish."

Fixed by correcting that one cell to `"677 Espurr"` (same column width/
padding as neighboring rows). Ran the full ingestion order per
[ingestion-runbook.md](ingestion-runbook.md) (`ingest:fetch` — already had
Espurr cached, since that step iterates the raw 1–1025 dex range independent
of the Forms CSV parse — then `ingest:gigantamax`, `ingest:build`,
`ingest:events`, `ingest:csv:import data-authoring/event-pokemon.csv`,
`ingest:check-slugs`). Result: 1,025 species (up from 1,024), Espurr present
with sane data (Kalos, gen 6, Standard male/female forms, no Mega/Gigantamax/
Shadow — matches the CSV's dashes). `ingest:check-slugs` passed clean.
Re-ran `ingest:sprites` afterward; Espurr's base sprite (`public/sprites/
677.png` + shiny) now matches and was visually confirmed as the right
Pokémon.

---

## Running totals

- After batch 1: 284 form slugs matched, 1,202 extra-images rows remaining.
- After batch 2 (before the mislabeling fix): 375 form slugs matched, 1,140
  extra-images rows remaining.
- After the form/costume-token mismatch fix: 371 form slugs matched (the 2
  bogus Ponyta/Zigzagoon "-standard-" slugs removed), 1,144 extra-images
  rows (Ponyta's and Zigzagoon's Galarian+Meloetta-hat files correctly moved
  to the hand-check pile instead of being silently mismatched).
- After batch 3: 560 form slugs matched, 852 extra-images rows remaining.
  Only 9 codenames remain unresolved in `costume-lookup.json`, all
  documented above as genuinely blocked (a data gap, a script limitation,
  or insufficient visual confidence) rather than simply unattempted.
- After the Espurr fix: 1,025 species (up from 1,024), 1,833 species base
  sprites matched (up from 1,831).
- After batch 4: 564 form slugs matched (up from 560), 836 extra-images
  rows remaining (down from 852). 5 codenames remain unresolved in
  `costume-lookup.json`, all for reasons other than "not looked at yet."
