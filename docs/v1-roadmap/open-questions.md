*Part of the [V1 Roadmap](README.md). Previous: [Addendum (2026-07-08 owner decisions)](addendum.md).*

## Open questions for the owner

Collected from every reviewer; D1–D7 in the workplan are the blocking ones.
Additional non-blocking asks:

1. **RESOLVED (moot), 2026-07-14.** The `001-Bulbasaur/Standard.md`
   Obsidian-refs question (may contain real personal progress) — no file or
   folder by that name exists anywhere in the current `Refs from Obsidian/`
   working folder (owner confirmed; that folder's actual current contents are
   `Mega.md`, `Partial pokemon list.csv`, `pokemon_species.csv`, `Pokedex
   Sheet Recovery.xlsx`, plus sprite assets — a flat scratch/working area for
   things the owner doesn't want committed, not a per-species vault mirror).
   Whatever prompted this question no longer applies to the folder as it
   exists today. (Carried from TODO.md)
2. **RESOLVED, already closed 2026-07-10 (commit `ebb94d4`), tracking never
   updated to reflect it.** The actual five confirmed bogus (no supporting
   Mega art exists) are **Uxie/Mesprit/Azelf/Butterfree/Lugia** — not
   Malamar/Falinks, which this item's own phrasing (and
   `01-reference-data-correction.md`'s summary of it) mis-stated; see that
   doc's corrected entry. Malamar and Falinks were confirmed *real* by that
   same commit and already carry working `mega_variant` rows. Independently
   reconfirmed 2026-07-14: the owner's own in-game Pokédex Mega list
   (`Refs from Obsidian/Mega.md`) shows dex #687 (Malamar, Kalos) and #870
   (Falinks, Galar) — both present, matching the existing data exactly.
   (Domain)
3. **DEFERRED to post-V1 (owner, 2026-07-14).** The ~65 unverified-genderless
   species and 385 inherited-availability forms ride as-is for V1 — the
   owner is planning a heavier DB rework post-V1 ([§ 12](../v1-tasks/09-v2-watchlist.md))
   that this naturally folds into, rather than a standalone pre-V1 pass.

---

## Coverage map (requested roles → where addressed)

| Requested role | Where covered |
|---|---|
| Product management | Exec summary, Themes 3, 4, 8; workplan |
| UX/UI design | Theme 5; Themes 3.2, 4 |
| Frontend architecture | Themes 1.2–1.3, 3.2, 7; "Deliberately NOT in V1" |
| Android/PWA experience | Themes 1.1, 1.5, 4, 6; Phase 6 |
| Pokémon domain | Theme 2; V1.x/V2 outlook |
| Pokémon GO domain | Themes 2, 3.1, 3.3; declutter safety clause |
| QA | Theme 7; Phase 6 |
| Accessibility | Theme 5 |
| Performance | Theme 4; "Deliberately NOT in V1" |
| Release planning | Themes 1.1, 8; Phases 0, 6; D4–D6 |
| User documentation | Theme 8 (friends); Phase 5 |
| Admin documentation | Theme 8 (operator); ingestion runbook |
| Dev documentation | Theme 8 (developer); Theme 7 hygiene |
