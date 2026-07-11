# Costume-lookup.json verification log

Tracks every `scripts/ingest/costume-lookup.json` entry filled in by an
automated first pass (image inspection + cross-referencing `reference.json`'s
existing `costumeName` strings), split by confidence — so a human check only
has to look at what's actually uncertain instead of re-deriving all of it.
Update this file as entries get confirmed, corrected, or resolved.

Companion to [`docs/v1-tasks/05-image-pipeline.md`](v1-tasks/05-image-pipeline.md)
§7.

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

### Left blank / blocked

| Codename | Species affected | Why it's blocked |
|---|---|---|
| `GOTOUR_2023_BANDANA` | Pikachu | Red/black/white striped bandana. Checked every costumeName in the entire `reference.json` for anything containing "bandana" or "tour" — nothing exists. This looks like a real costume the app's reference data is simply missing, not a lookup-value problem. |

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
`costume-lookup.json` can make this resolve — the script itself needs to
also branch on the form token when both are present. Not fixed as part of
this pass; flagged here so it isn't mistaken for a missing lookup entry next
time someone triages `extra-images.csv`.

---

## Running totals

- After batch 1: 284 form slugs matched, 1,202 extra-images rows remaining.
- After batch 2: 375 form slugs matched, 1,140 extra-images rows remaining.
