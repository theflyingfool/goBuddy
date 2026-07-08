*Part of the [V1 Roadmap](README.md). Previous: [The V1 workplan](workplan.md). Next: [Open questions & coverage map](open-questions.md).*

## Addendum (2026-07-08): owner follow-up decisions

After reading this report, the owner raised four points the six-specialist
review didn't fully anticipate. Three follow-up read-only explorations (schema/
slug/mega architecture, the ingestion + runtime DB pipeline, and the owner's
`Refs from Obsidian/pogo_assets` image folder) grounded the decisions below.
**These decisions are authoritative and supersede anything above that conflicts
with them.** The full granular breakdown lives in `docs/v1-tasks/`.

1. **Identity/slug rework — deferred to V2.** The owner's typo-fear (Theme 2)
   is justified, but the fix is bigger than V1 scope; **V1 only does the
   Theme 2 correction pass** (fix already-known-wrong slugs before any real
   install), and the slug-rename registry remains the safety net for anything
   found later. Full rationale — why this is fragile today, and the "unify
   with the image-pipeline's numeric IDs" insight for V2 — now lives in
   [data-model.md § Future direction](../data-model.md#future-direction-deferred-not-yet-built),
   since it's architecture, not a status report. Status: `docs/v1-tasks/09-v2-watchlist.md`.
2. **Reference/personal DB file split — deferred to V2**, bundled with the
   identity rework above; the owner wants it done properly alongside that
   rework, not rushed into V1. Full rationale now lives in
   [data-model.md § Future direction](../data-model.md#future-direction-deferred-not-yet-built).
   **V1 contingency**: ship the safety net from Theme 1 (orphan quarantine,
   rescue screen, migration hardening) regardless of file layout; only pull the
   `executeSet`-batching fix forward into V1 if real-device testing (Phase 6)
   shows the current 8,156-insert runtime sync is actually slow enough to hurt
   the first-run experience. Status: `docs/v1-tasks/06-performance-and-quality-infra.md`,
   `docs/v1-tasks/09-v2-watchlist.md`.
3. **Image pipeline — full scope, in V1** (expands the original Theme 4 sprite
   fix). The image folder was identified as **`PokeMiners/pogo_assets`** — an
   actively-maintained git checkout of Niantic's own extracted Pokémon GO
   assets (2,213 PNGs, dex 1–867, e.g. `pokemon_icon_025_00.png`). Species-level
   matching (parse the dex number, matches the app's own `NNN.png` convention
   already) is trivial. Form/costume-level matching needs one more public
   lookup table (the game-master's numeric form/costume ID → name mapping,
   e.g. `pokemon_icon_025_00_11.png` = a specific Pikachu costume) — a solved,
   documented problem, not manual per-image curation. The owner wants this
   done fully: **each form should show its correct costume art in V1**, not
   just a species-level fallback. This wires the already-reserved-but-unused
   `form.imageRef` column for the first time.
4. **The UI needs a real visual design pass, not just accessibility patches.**
   The owner: *"We need a more professional UI from day one."* Confirmed as its
   own V1 workstream, sequenced **before** Theme 5's contrast/legibility fixes
   so those fixes land once against a deliberately-designed visual system
   (palette, type pairing, spacing/layout) instead of being redone after a
   later redesign. Theme 5's specific findings (cryptic chips, unsearchable
   188-form page, drawer accessibility, etc.) remain valid and still ship — they
   just execute against the new visual system, not the current one.
