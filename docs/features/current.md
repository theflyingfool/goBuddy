# Current features — as of v0.10.0

What's actually built and shipped, as of the current release
(`package.json`/`android/app/build.gradle` version). Where a feature is
already built, the code is the source of truth — this captures the *intent*
and design constraints that must survive refactors, not implementation
detail.

## Completion / progress stats

The primary feature — the main reason the app exists, more than the
declutter engine (see [planned.md](planned.md)).

A general-purpose completion system with two independent axes, rather than
hardcoded per-region views:

**Scope** — what set of species/forms is being measured:

- A region (species whose `region_slug` matches — note regions are assigned
  by dex-number origin, not by which forms happen to exist; e.g. Unown is
  scoped to Johto and Deoxys to Hoenn even though most of their many forms
  aren't regional exclusives)
- A single species drill-down (e.g. "all 28 Unown forms," "all Deoxys forms")
- Eventually: all species globally

**Lens** — what "complete" means, applied within that scope:

- **Registered** — at least one form of the species caught, any form/gender
  (maps to `species_personal.registered`)
- **Form-complete** — every non-costume form/gender of the species caught
  (i.e. every `form_personal.caught = true` where `costume_name IS NULL`).
  See [next.md](next.md) for the open denominator-semantics decision (D2)
  affecting this lens.
- **Costume-complete** — every released costume owned, per species or per
  region
- **Achievement-complete, parameterized by column** — every species in
  scope has a given `form_personal` boolean true (e.g. "all of Kanto has a
  shiny," "all of Kanto has a lucky," "all of Kanto has a shundo"). Works
  generically against any boolean column in `form_personal`, not hand-built
  per achievement type.

Implemented as parameterized SQL queries (scope + lens as inputs) in
`src/data/completion-stats-sql.ts` — not as one-off queries per region or per
achievement type.

## Data entry

Fast mobile-first checklist/toggle UI per species/form
(`src/features/data-entry/species-detail.ts`,
`src/features/data-entry/bulk-form-edit.ts`) — at least as fast as tapping
properties in Obsidian, which is the UX bar this replaced. The cascade
(`src/db/cascades.ts`) — checking "Shundo" auto-checks shiny/4★/caught/
registered — is the single biggest reason this beats the Obsidian tapping
speed.
