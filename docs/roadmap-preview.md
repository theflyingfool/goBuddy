# Future Roadmap (PoGo Buddy)

This document is a preview of the standalone future roadmap guide, mapping planned features, enhancement checklists, and target versions.

---

## 1. Master Roadmap Checklist

A high-density list of planned features grouped by functional area.

### Progression & Stat Trackers
- [ ] **Multi-Account & Sharing**: Allow importing databases from friends to show completion comparisons and trade gap analysis.
- [ ] **Level Tracker**: Track total XP progression to level 80 and display required level-up tasks.
- [ ] **Medal Tracker**: Medal progress metrics, checklists, and strategic advice for unlocking achievements.
- [ ] **Best Buddy Tracker**: Track buddy status, ribbon achievements, and active CP level boosts.
- [ ] **Buddy Heart Daily Tracker**: Log daily buddy points (play, feed, snapshot, battle, walk) with calculators estimating days remaining to Best Buddy.
- [ ] **Routes & Zygarde Cell Tracker**: Track Route completions and daily Zygarde Cell progression toward 50% and 100% Zygarde Formes.
- [ ] **Gym Badge Tracker**: Track personal Gym badges (Bronze, Silver, Gold) with custom name and location markers.

### Battle & PvP Reference Tools
- [ ] **PVP/PVE Team Builder**: Simulator for building optimized team compositions based on movesets, type matchups, and IV stats.
- [ ] **PVP Stat Product / Rank Calculator**: Offline rank calculator taking a species and IV spread to calculate exact stat product and PvP rank (1–4096) for Great/Ultra Leagues.
- [ ] **Type Effectiveness Matrix**: Offline quick-reference battle helper for checking weaknesses, resistances, and immunities.
- [ ] **Raid Counter Simulator**: Select a raid boss and show the top offline-recommended counter species and optimal movesets.

### Capture & Encounter Utilities
- [ ] **Wild 100% IV CP Lookup**: Offline tables showing exact CP values signaling a potential wild 100% IV encounter for levels 1–35 (standard & weather-boosted).
- [ ] **Wild CP OCR Assistant**: Fully offline client-side OCR (e.g. Tesseract.js) parsing wild encounter screenshots to instantly flag matching possible 100% IV CPs.
- [ ] **Raid Boss 4★ CPs**: Display maximum CP thresholds for perfect-IV (4★) Raid boss encounters to simplify capture checks.
- [ ] **Showcase Score Calculator**: Calculate estimated showcase points (0-1000) for weight, height, and IV combinations to identify top showcase contenders.
- [ ] **Catch Rate Calculator**: Input species, ball type, throw quality, berry, and medal tiers to calculate the exact catch percentage.
- [ ] **Shadow Purification Calculator**: Predicts if a shadow Pokémon's IVs will result in a perfect 100% (4★) IV upon purification (+2 to all stats).

### Collection & Data Helpers
- [ ] **Caught Notes**: Ability to attach custom notes/stamps to individual caught forms (e.g., date caught, trade origin, location).
- [ ] **Trade Board Registry (LF/FT)**: Local trade board logging duplicate shinies/costumes "For Trade" (FT) and missing dex requirements "Looking For" (LF).
- [ ] **Evolution Candy Calculator**: Local resource planner estimating total candies, candy XLs, and special items required to complete living-dex evolutions.
- [ ] **Egg Hatch Checklist**: Track current egg pool reference lists (2km, 5km, 7km, 10km, 12km) and tick off hatch-only achievements.
- [ ] **Manual Search Builder**: Tri-state toggle UI (off → include → exclude) generating valid GO search strings with `&`/`,`/`!` operators.
- [ ] **Auto-Declutter Engine**: SQL-based reduction engine generating a single grouped transfer query (e.g. `1,3,25&!4*&1*,2*,3*`).
- [ ] **Background Legality**: Track form-specific background legality instead of assuming every background is legal on every form.
- [ ] **Coverage Report Persistence**: Save gap-reviewed state via `coverage_reviewed` settings flags.
- [ ] **Bulk Edit Pagination**: Introduce pagination controls or an adjustable display cap setting to optimize rendering speed.
- [ ] **Page-Mode Consolidation**: Collapse Dex Grid and Bulk Edit into a single route, using a toggled "Browse vs Edit" layout mode.
- [ ] **UI Tile Unification**: Refactor Dex `.species-tile` and Bulk Edit/Detail `.form-tile` into a shared component.

---

## 2. Detailed Roadmap Table

Use this table during development to track progress status, notes, and target version releases.

| Feature Name | Target Version | Status | Development & Versioning Notes |
| :--- | :---: | :---: | :--- |
| **Multi-Account & Sharing** | `v1.1.0` | Planned | Compare local database vs imported JSON dump from a friend to highlight trade gaps. |
| **Caught Notes** | `v1.1.0` | Planned | Store notes inside a new `personal_notes` table keyed by form slug. |
| **Raid Boss 4★ CPs** | `v1.1.0` | Planned | Reference dataset mapping raid boss species to their perfect CP encounters at level 20 (and level 25 weather boosted). |
| **Showcase Score Calculator** | `v1.1.0` | Planned | Local math helper taking species, height, weight, and IV stats to compute local showcase score. |
| **Shadow Purification** | `v1.1.0` | Planned | Quick UI lookup to see if shadow IV stats are >= 13/13/13 (resulting in 15/15/15 when purified). |
| **Evolution Resource Calc** | `v1.2.0` | Planned | Candy/Item calculator to estimate the resources needed to finish regional dex evolutions. |
| **Type Matchup Matrix** | `v1.2.0` | Planned | Simple grid interface mapping offense/defense multipliers on species view pages. |
| **Best Buddy Tracker** | `v1.2.0` | Planned | Checkboxes tracking best buddy ribbons and daily buddy activity logs. |
| **PVP/PVE Team Builder** | `v2.0.0` | Planned | Simulation engine calculating type matchup coverages and ideal movesets. |
| **PVP Rank Calculator** | `v2.0.0` | Planned | Offline stat-product calculator matching custom IVs against the optimal PvP level stats. |
| **Wild 100% IV Lookup** | `v2.0.0` | Planned | Wild encounter CP guide for perfect stats at levels 1 to 35. |
| **Wild CP OCR Assistant** | `v2.0.0` | Planned | OCR tool scanning overlay captures to parse CP values offline. |
| **Trade Board LF/FT** | `TBD` | Planned | Interface to export a small "trade checklist" text sheet to share with local communities. |
| **Zygarde / Routes Tracker** | `TBD` | Planned | Progress checklist showing route completions and Zygarde Cell counts. |
| **Gym Badge Tracker** | `TBD` | Planned | Basic local list of visited gyms and badge tiers. |
