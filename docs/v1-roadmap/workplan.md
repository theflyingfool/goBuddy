*Part of the [V1 Roadmap](README.md). Previous: [Theme 8 — Documentation](08-documentation.md). Next: [Addendum (2026-07-08 owner decisions)](addendum.md).*

## The V1 workplan (sequenced)

Effort: **S** = hours, **M** = a day or two, **L** = multi-day.

**Phase 0 — Decisions (owner, this week; everything below depends on some of these)**
| # | Decision | Recommendation |
|---|---|---|
| D1 | Gigantamax: form-rows-only, or also a personal field? | Form-rows-only; hide Dynamax branch on G-max rows |
| D2 | Form-complete semantics: regional exclusives? G-max? | Exclude regional exclusives from the default lens; consider a separate G-max lens |
| D3 | Desktop packaging | Launcher script + persist() + pinned port + PWA manifest |
| D4 | Keystore backup strategy (commit to private repo?) | Yes, plus one off-repo copy |
| D5 | `allowBackup` stance | Keep on, but treat Export as the real backup; test restore once |
| D6 | One app name | Owner's call (PoGo Buddy vs GoBuddy) |
| D7 | Confirm costume-code identifications (Theme 2 #7) | Verify vs Bulbapedia sprites, then slug |

**Phase 1 — Reference-data correction pass (before ANY real install; mostly S, ingestion-side)**
Necrozma swap · phantom Standards purge (+shiny-flag migration) · gen-9
slug/dex fixes · Crowned Zacian/Zamazenta · six missing megas · G-max
availability tightening · costume names (post-D7) · Mega Dimension record
correction · slug-stability check script (so this pass itself can't orphan
anything later).

**Phase 2 — Safety net (S–M each; the true release gate)**
Release keystore + signed builds (D4) · boot-failure rescue screen ·
reference-sync orphan quarantine · write-failure banner + import skip-reporting
· pre-import auto-snapshot · `storage.persist()` + rotating Android auto-export
· migration-runner hardening (transaction-wrap, downgrade guard) with fixture
tests.

**Phase 3 — V1 features (M total)**
Mega vertical slice (repository → export format → detail UI → lens/chip, after
Phase 1's mega data fix) · G-max branch semantics per D1 · form-complete
semantics per D2 · stats drill-down: region expansion + clickable species +
scroll-into-view.

**Phase 4 — Legibility & polish (S each)**
Chip labels/legend + `aria-pressed` · detail-page form filter box · pinch-zoom
re-enable · contrast fixes · drawer a11y · bulk-edit focus-loss fix · in-place
select-mode toggling + debounced filter · nav de-noising · missing-sprite
fallback (art sourcing may be M) · `aria-live` status region · app version in
Settings.

**Phase 5 — Docs & release process (S–M)**
In-app Help page · backup guidance · install/update one-pager ·
ingestion-runbook.md · release checklist + CHANGELOG start · TODO.md refresh ·
data-model.md divergence pass · commit `docs/` (do this first, it's blocking a
clean clone today).

**Phase 6 — Release candidate**
Real-device install + first-boot timing (batch reference-sync inserts if slow —
likely) · upgrade-over-install test (v1 APK + data → v2 APK) · committed smoke
suite + CI green · tag v1.0.0 · distribute with the one-pager.

**Minimum credible V1** = Phases 0–3 + the blocking items of 4–5 (chip
legibility, form filter, pinch-zoom, contrast, drawer, sprites, Help/backup
docs) + Phase 6. Everything else marked V1-nice degrades gracefully.

---

## Deliberately NOT in V1 (and why that's safe)

- **Search-string builder & declutter engine** — deferred by scope decision.
  Architecture confirms the deferral is safe: they become additional SQL-only
  repository methods following the existing stats pattern; the boolean-column
  schema is exactly what the spec'd GROUP-BY-rule string-aggregation query
  needs. **Done**: the declutter **safety clause** now lives in
  `docs/features/planned.md` — generated transfer-search strings must always
  exclude `favorite` and `specialbackground` at minimum, and default to
  protecting shiny/lucky/costume/legendary/etc.; the 0★ question and the
  multi-rule priority order are recorded there as still-open. As specced
  originally, the example string would have happily marked a shiny costume
  Pikachu for transfer — this was the app's scariest future failure mode and
  cost one paragraph to prevent.
- **A framework rewrite** (React/Preact/etc.) — unanimous "don't." ~3,700
  lines of working, tested-in-anger code for a handful of users. Revisit only
  when building the highly-interactive declutter/search UIs, possibly as
  incremental adoption. Same for the row-per-fact schema alternative: the
  25-boolean-wide table is well-served by the type system built around it, and
  new achievement *kinds* are rare; conversion cost vastly exceeds benefit.
- **Virtualization** of the grid — region-collapse + targeted in-place updates
  are proportionate; revisit only if real-device testing still shows jank.
- **Packaged desktop app**, **APK diet** (code-splitting the never-executed
  web-SQLite code out of native, sprite compression — ~1MB of a 38MB APK),
  **fetch-instead-of-bundle for reference.json** (nice, cheap, but cosmetic in
  a local app — do it opportunistically).

---

## V1.x / V2 outlook

**V1.x (next after V1):**
- **Search-string builder**, then the **declutter engine** (with the safety
  clause and priority order specced in V1). Domain adds search-palette
  candidates for the builder: `hatched`, `raid`, `research`, `rocket`,
  `traded`, `age`, `distance`, `evolve`, `megaevolve`, `specialbackground`;
  the game's term for Ultra Beasts in search is `ultrabeasts`; GO search has
  no parentheses, so the builder must keep users inside AND-of-ORs.
- **Stats region drill-down expansion** if not fully landed in V1; dark-mode
  audit + toggle; one ≥768px desktop breakpoint (the bulk-edit page and stats
  table are where desktop width pays off).
- **Background tracking UI** — still blocked on real background data existing
  anywhere; keep dormant.

**V2 / watchlist (domain-driven, revisit each GO season):**
- **Z-A/Mega Dimension megas reaching GO**: the ingestion version-group filter
  will block them by design — plan the filter change; the mega-variant enum
  survives (Raichu X/Y fits the existing X/Y shape). A **mega level**
  (Base/High/Max) column is the one mega fact collectors grind beyond
  "evolved once" — cheap future migration.
- **Purified per-form branch** (purified-lucky/shiny/hundo are real hunt
  categories; a "purified shundo" is unrecordable today — currently an
  undocumented simplification, worth documenting in V1, building later).
- `paradox` rarity when GO releases Paradox Pokémon; Meltan's "Unknown" dex
  region; Hisui section alignment; Alcremie's 63-decoration explosion when
  Milcery reaches GO; Ogerpon masks / Squawkabilly plumages when relevant.
- **The achievements/XP phase** (the app's stated broader future): per
  CLAUDE.md, non-dex facts get their own tables — nothing in V1 constrains
  this; keep it that way.
