*Part of the [V1 Task Breakdown](README.md). Previous: [11. Release candidate](08-release-candidate.md).*
*Roadmap context: [Addendum](../v1-roadmap/addendum.md), [The V1 workplan](../v1-roadmap/workplan.md).*

## 12. V2 watchlist (explicit, so nothing here gets lost)

- Identity/slug rework unified with the image-pipeline's numeric IDs
  ([§ 7](05-image-pipeline.md)) — likely Niantic's own game-master
  form/costume ID enum as the stable key, slug becoming a purely
  cosmetic/display column. Full rationale: `docs/data-model.md`'s "Future
  direction" section.
- Reference/personal database file split (two physical SQLite files). Full
  rationale: `docs/data-model.md`'s "Future direction" section.
- Full adoption of `executeSet`/`importFromJson`/`copyFromAssets` if not
  pulled into V1 via [§ 8](06-performance-and-quality-infra.md)'s
  contingency.
- Search-string builder (safety-adjacent spec work already done in
  `docs/features/planned.md`).
- Auto-declutter engine (safety clause specced in `docs/features/planned.md`;
  multi-rule priority order still needs deciding when this is built).
- Purified per-form branch (purified-lucky/shiny/hundo), `paradox` rarity,
  Hisui/"Unknown" dex-region alignment, Alcremie's decoration explosion (if
  Milcery reaches GO), mega level (Base/High/Max) column, the Z-A-megas
  ingestion-filter update (when those megas reach GO).
- **D3**: desktop packaging, if not resolved during V1 (roadmap recommends
  the launcher-script option).
- Dark-mode manual toggle, one ≥768px desktop breakpoint (if not finished in
  [§ 3/§ 4](03-visual-and-legibility.md)).
