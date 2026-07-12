*Part of the [V1 Task Breakdown](README.md). Previous: [8–9. Performance & quality infra](06-performance-and-quality-infra.md). Next: [11. Release candidate](08-release-candidate.md).*
*Roadmap context: [Theme 8 — Documentation](../v1-roadmap/08-documentation.md).*

## 10. Documentation & release process

- [x] Commit `docs/` — already tracked in git as of this pass (this checklist
  item had gone stale; `docs/` shows up in `git status`/`git diff` normally).
- [x] In-app Help page: `src/features/help/help-page.ts` (new route `/help`,
  in the nav's "More" section). Covers a representative slice of badge
  glyphs (not all 30 combos — the prefix/base-stacking rule is explained
  once instead of repeated per combo), all 5 stats lenses with their
  denominator rules, the Floor/Shundo glossary (pulled from
  `docs/data-model.md`'s DDL comments: floor = 0/0/0 normal, 12/12/12
  lucky; shundo = independently-stored shiny+hundo), and the tri-state
  filter-chip cycle. **Not visually verified** — no browser in this
  environment; on-device/browser check still needed.
- [x] Backup guidance text next to the Export button
  (`src/features/settings/settings-page.ts`): "This file is your only
  backup — export it after play sessions, and before updating or
  reinstalling the app."
- [x] Install/update one-pager for friends: `docs/install-guide.md`.
- [x] Write `docs/ingestion-runbook.md`: the correct script order
  (`ingest:fetch` → `ingest:gigantamax` → `ingest:build` → `ingest:events` →
  `ingest:csv:import -- <path>`), the silent-skip and destructive-reorder
  pitfalls already found, and the slug-diff checkpoint step.
- [x] Start `CHANGELOG.md` (Keep-a-Changelog style, seeded from recent
  version-bump commits; now the canonical home for shipped-version history,
  superseding `TODO.md`'s Done section going forward).
- [ ] Release checklist (version bump, tag, build, upgrade-install test,
  "export before updating" reminder) — still open, `CHANGELOG.md` alone
  doesn't cover this.
- [x] ~~Refresh `TODO.md`~~ — moot, `TODO.md` was retired earlier (see
  `CHANGELOG.md`/git history); `CHANGELOG.md` and this task breakdown are
  its replacements.
- [ ] `docs/data-model.md` divergence pass: add the Gigantamax modeling
  decision, the mega columns, `form_personal`'s shiny fields, and other
  DDL-vs-`schema.ts` drift found by the documentation review. (Distinct from
  this pass's data-model.md addition, which only added the "Future
  direction" section — the DDL-vs-schema.ts sync itself is still open.)
- [x] Show the app version somewhere in Settings. `vite.config.ts` reads
  `package.json`'s version at build time and injects it as the
  `__APP_VERSION__` global (declared in `src/vite-env.d.ts`); Settings'
  new "About" fieldset renders it. Confirmed the exact version string
  (`0.11.0`) actually lands in the built bundle, not just that it
  type-checks.
- [x] Write the auto-declutter engine's safety clause into
  `docs/features/planned.md`: generated transfer-search strings must exclude
  `favorite`/`specialbackground` by default and protect
  shiny/lucky/costume/legendary; the 0★ inclusion question and the
  multi-rule priority order are recorded there as still open.
- [x] `docs/architecture.md`: the codebase map Theme 8 recommended, covering
  `src/features/`, `src/db/`, `src/data/`, `scripts/ingest/`, and the
  write-queue/cascade/dual-backend/field-list patterns.
