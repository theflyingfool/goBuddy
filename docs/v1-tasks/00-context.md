*Part of the [V1 Task Breakdown](README.md). Next: [1. Reference-data correction](01-reference-data-correction.md).*

## 0. Already decided — don't re-litigate these

From `docs/v1-roadmap/workplan.md` Phase 0:

- **D1 — Gigantamax modeling: RESOLVED.** Form-rows-only (commit `36e5754`
  already does this) — no extra personal field. Owner confirmed 2026-07-08.
- D2 (form-complete semantics), D3 (desktop packaging), D5 (`allowBackup`
  stance) — **still open**, each is its own task below.
- **D4 (keystore backup location): RESOLVED, closed.** Owner (2026-07-12):
  not dealing with a release keystore at all — ships debug-signed
  indefinitely, people can back up their own personal data before updating.
  No `signingConfigs.release` work planned.
- **D6 (app name): deferred past V1**, not re-opened. Owner (2026-07-08):
  name suggestions so far only optimized for V1's dex-tracking scope, not
  the app's longer-term companion-app ambitions — revisit once that scope
  is closer to real.
- **D7 (costume-code confirmation): folded into Coverage Report
  persistence** (owner, 2026-07-12) — see [§ 12](09-v2-watchlist.md) and
  `docs/features/planned.md`. No longer a standalone pre-V1 task; the
  ~11 unconfirmed costume codes ride as Coverage Report items like any
  other flagged gap, reviewed post-V1 once that system exists.

From the 2026-07-08 addendum:

- Identity/slug rework → **V2** (see [§ 12](09-v2-watchlist.md)), unified
  with image-pipeline IDs.
- Reference/personal DB file split → **V2** (see [§ 12](09-v2-watchlist.md));
  the insert-loop performance fix is a **V1 contingency** on real-device
  timing ([§ 8](06-performance-and-quality-infra.md),
  [§ 11](08-release-candidate.md)).
- Image pipeline (species + per-form art) → **full scope, V1**
  ([§ 7](05-image-pipeline.md)).
- Visual identity pass → **new V1 workstream**, sequenced before legibility
  fixes ([§ 3, then § 4](03-visual-and-legibility.md)).

**Carried-over open questions** (non-blocking, revisit opportunistically):
the `001-Bulbasaur/Standard.md` Obsidian-refs question (may hold real personal
progress — decide before deleting that folder); whether to verify the
Uxie/Mesprit/Azelf/Malamar/Falinks "bogus mega-capable" flags against the
Z-A mega list ([§ 1](01-reference-data-correction.md) touches this); whether
the ~65 unverified-genderless
species and 385 inherited-availability forms need a manual pass or can ride
as Coverage-Report-flagged caveats (lean: ride).
