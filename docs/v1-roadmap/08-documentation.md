*Part of the [V1 Roadmap](README.md). Previous: [Theme 7 — Quality infrastructure](07-quality-infrastructure.md). Next: [The V1 workplan](workplan.md).*

## Theme 8 — Documentation: three audiences, two of them unserved

- **Friends (currently: nothing).** Highest-severity docs item, because it's
  really a data-safety item: the only mechanism protecting their data is a
  feature (Export) they won't understand the importance of unless told.
  - An **in-app Help page** (friends never see the repo): badge/glyph legend,
    lens definitions (Registered vs Form-complete vs Costume-complete and its
    denominator rule), floor/shundo glossary, tri-state chip explanation.
  - **Backup guidance next to Export**: "this file is your only backup; export
    after play sessions; on desktop, clearing browser data erases everything."
  - **An install/update one-pager shipped alongside the APK link**: sideload
    steps (unknown-sources and Play Protect prompts), and the sentence the
    whole architecture exists to make true: *"install the new APK over the old
    one — your data survives."*
- **The owner-as-operator, months from now.** The full season-update flow
  (`ingest:fetch` → `ingest:gigantamax` → `ingest:build` → `ingest:events` →
  `ingest:csv:import -- …` → Coverage Report check → commit) exists **only**
  spread across five script headers and an incident postmortem; README's
  ingestion section omits `ingest:gigantamax` entirely and gives no ordering —
  and the documented stale-gaps incident proves ordering mistakes happen. Write
  **docs/ingestion-runbook.md** with the slug-diff checkpoint step, plus a
  **release checklist** (version bump, tag, changelog, release build,
  upgrade-install test, "export before updating" reminder to friends).
- **The developer / future self.** The docs culture is unusually good but
  drifting: TODO.md went stale against the last five commits (it still lists
  the Gigantamax question as open, and claims a `form.gigantamax_available`
  column that doesn't exist in the shipped schema); `docs/data-model.md`'s DDL
  silently diverges from `schema.ts` (the Gigantamax modeling decision lives
  only in a code comment); the dual-backend architecture, write-queue pattern,
  and cascades are documented nowhere but TODO narratives. Fix: refresh
  TODO.md, add the divergence notes to data-model.md, write a short
  docs/architecture.md, and long-term move Done-section narratives to a
  CHANGELOG so TODO.md stays a status doc (its 32KB append-only format went
  stale within hours of its own reorganization commit).
- Also: show the app version somewhere in Settings — a friend reporting a bug
  currently has no way to tell you which build they're on. (Product)
