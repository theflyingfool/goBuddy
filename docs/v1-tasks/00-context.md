*Part of the [V1 Task Breakdown](README.md). Next: [1. Reference-data correction](01-reference-data-correction.md).*

## 0. Already decided — don't re-litigate these

From `docs/v1-roadmap/workplan.md` Phase 0:

- **D1 — Gigantamax modeling: RESOLVED.** Form-rows-only (commit `36e5754`
  already does this) — no extra personal field. Owner confirmed 2026-07-08.
- D2 (form-complete semantics), D3 (desktop packaging), D4 (keystore backup
  location), D5 (`allowBackup` stance), D6 (app name), D7 (costume-code
  confirmation) — **still open**, each is its own task below.

From the 2026-07-08 addendum:

- Identity/slug rework → **V2** (see § 12), unified with image-pipeline IDs.
- Reference/personal DB file split → **V2** (see § 12); the insert-loop
  performance fix is a **V1 contingency** on real-device timing (§ 8, § 11).
- Image pipeline (species + per-form art) → **full scope, V1** (§ 7).
- Visual identity pass → **new V1 workstream**, sequenced before legibility
  fixes (§ 3, then § 4).

**Carried-over open questions** (non-blocking, revisit opportunistically):
the `001-Bulbasaur/Standard.md` Obsidian-refs question (may hold real personal
progress — decide before deleting that folder); whether to verify the
Uxie/Mesprit/Azelf/Malamar/Falinks "bogus mega-capable" flags against the
Z-A mega list (§ 1 touches this); whether the ~65 unverified-genderless
species and 385 inherited-availability forms need a manual pass or can ride
as Coverage-Report-flagged caveats (lean: ride).
