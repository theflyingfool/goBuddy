# Planned — specced, deferred past the next release (V1.x+)

Full design specs for features that are fully thought through but not yet
being built — nothing tracks their implementation in `docs/v1-tasks/` yet,
so this doc is their only home. Deferring them past the next release is a
deliberate scope decision (see `docs/v1-roadmap/workplan.md`'s "Deliberately
NOT in V1" section): the parameterized-query pattern and boolean-column
schema that [current.md](current.md)'s stats feature already uses are
exactly what both of these need, so the deferral doesn't paint the
architecture into a corner.


## Level Tracker

Track total XP to get to level 80 as well as tasks required

## Medal tracker

Track progress and possibly give advise on medals

## Trade analyzer

Check if trade is "fair"

## PVP & PVE Team builder



## Manual search-string builder

Tri-state toggle UI (off → include → exclude → off) across standard PoGo
search criteria (star tiers, shiny, lucky, shadow, purified, costume,
legendary, mythical, ultra beast, favorite, dynamax, gigantamax). Live-builds
a valid PoGo search string using real operators: `&` = AND, `,` = OR,
`!` = NOT. Live match count against personal data as a sanity check.

Additional search-palette candidates identified during the V1 studio review:
`hatched`, `raid`, `research`, `rocket`, `traded`, `age`, `distance`,
`evolve`, `megaevolve`, `specialbackground`; the game's term for Ultra Beasts
in search is `ultrabeasts`; GO search has no parentheses, so the builder must
keep users inside AND-of-ORs.

## Auto-declutter engine

A set of configurable rules, each of which:
- Tests a species' `form_personal` row (typically its default/standard form)
  for a trigger condition (e.g. `four_star = true`).
- If triggered, defines what's safe to clear for that species (e.g. exclude
  4★, target 1–3★ instead).

Default starter rules: already-have-4★, already-have-floor (lowest possible
IV), already-have-shiny, already-have-lucky. Should be easy to add more
without touching the query layer.

**Also a core reason this app exists over Obsidian Bases:** species must be
**grouped by which rule matched them**, and within each group, **combined
into a single search string** — species dex numbers/names OR'd together via
`,`, sharing one AND'd exclusion clause. E.g. if Bulbasaur, Venusaur,
Pikachu all have a banked 4★, the output is one string like:
```text
1,3,25&!4*&1*,2*,3*
```
not three separate strings. Species matching *different* rules produce
separate grouped strings (since their exclusion clauses differ), but species
matching the *same* rule must be merged into one. This cross-row reduce is a
SQL `GROUP BY` + string aggregation query — implement it as such, not as
in-memory JS looping, so it stays fast as the dataset grows.

### Safety clause (decide before building)

Generated transfer-search strings must always **exclude `favorite` and
`specialbackground` at minimum**, and default to protecting
shiny/lucky/costume/legendary/etc. As specced without this clause, the
example string above would happily mark a shiny costume Pikachu for
transfer — this is the app's scariest future failure mode and costs a
paragraph here to prevent.

Still undecided, needed before implementation:
- The 0★ inclusion question.
- Priority order for species matching multiple rules simultaneously (e.g.
  has both a hundo and a shiny) — don't leave this implicit.

## Coverage Report review-state persistence

*Owner-proposed (2026-07-12), scoped into a real spec the same day; deferred
to post-V1 — see `docs/v1-tasks/09-v2-watchlist.md`.*

The Coverage Report (`src/data/reference-gaps.json`, regenerated fresh by
every `npm run ingest:build`) currently has no memory: every ingestion pass
shows the full current gap list from scratch, so already-reviewed gaps get
re-reviewed every time. This adds a per-gap "reviewed" flag that survives
regeneration, plus folds in D7's costume-code confirmation questions as the
same kind of reviewable item rather than a separate one-off task.

**Key shape**: gaps aren't uniformly per-form — `mega-discrepancy`,
`unverified-gender`, and `possible-bogus-form` fire at species granularity
with no single form to blame (`formsForGaps()` in `coverage-report-page.ts`
already falls back to every form of that species when `gap.formSlug` is
absent). So the review key can't just reuse a form slug; it's
`{gap.kind}:{gap.formSlug ?? gap.speciesSlug}`.

**Storage**: no new schema-versioned table needed. The existing
`app_settings` key-value store already covers it —
`coverage_reviewed:{kind}:{key}` = `"1"` — since `app_settings` is
per-install/maintainer state, not personal collection data, and reference-
sync never touches it. Coverage Report gains a "show reviewed" toggle,
defaulting to hiding reviewed gaps.

**Costume-code confirmation (absorbed from D7)**: the ~11 still-unconfirmed
costume codes (Cap Pikachu O/W, Flying Pikachu Fly/Fly5/FlyOkinawa/…, see
`docs/v1-roadmap/02-reference-data-corrections.md` §7) become Coverage
Report entries needing a Bulbapedia-sourced confirmation, reviewed and
marked through this same mechanism rather than a standalone checklist.

## Bulk Edit: page-size / pagination controls

*Owner-proposed (2026-07-14): v1 removed Bulk Edit's flat 120-species display
cap entirely (`MAX_SPECIES_SHOWN` in `bulk-form-edit.ts`, plus its
"Showing the first N of M — narrow your filters" note) in favor of always
rendering every species a query matches, however large the list gets — no
settings, no truncation. This entry is the deferred follow-up: whether that
"always render everything" default needs a real control once it's lived with
a bit.*

Two directions floated, neither designed yet:
- An adjustable page-size setting (Settings → some default, e.g. 120/250/
  unlimited) rather than the current all-or-nothing.
- Real pagination — a "next page" control instead of one ever-growing list.

Whichever direction: v1's fix already made the select-all/bulk-apply bar
correct by construction (it operates on whatever's currently rendered,
which is now always the full match set) — any pagination design needs to
either keep that invariant (apply only touches the visible page) or make
"apply to all matches, not just this page" an explicit, clearly-labeled
choice, not an accidental scope change hiding behind the same button label.

If this turns out to need addressing sooner (e.g. a real broad query proves
slow to render on-device), it likely converts from "planned" to a v1.x
patch rather than waiting for V2 — worth a real device check with an
unscoped query once there's a large local collection to test against.

## Unify Dex-grid and form-tile rendering into a shared component

*Owner-proposed (2026-07-14).* The Dex grid's `.species-tile`/`.species-sprite`
(`species-grid.ts`) and Bulk Edit/species-detail's `.form-tile`/
`.form-tile-sprite` (`bulk-form-edit.ts`, `species-detail.ts`) are two
independent implementations of what is visually the same kind of tile —
sprite + overlay badges + a label box underneath. The 2026-07-14 tile-sizing
pass (matching column widths and sprite-fill behavior across both) had to
apply the same CSS values twice in two places, and any future tile-visual
change (sizing, spacing, badge layout) will keep needing to be made twice and
kept in sync by hand unless they're refactored onto one shared
rendering/CSS codebase. Not designed yet — just flagging the duplication
before a third tile variant makes it worse.

## Consolidate Dex grid and Bulk Edit into one page, toggled

*Owner-proposed (2026-07-15), prompted by noticing similar logic between the
Dex grid and Bulk Edit while the `fix/caught-uncaught-form-flag` bug fix was
in flight — related to, but distinct from, the tile-rendering duplication
entry above ("Unify Dex-grid and form-tile rendering into a shared
component").*

Idea: instead of two separate pages/routes for browsing (Dex grid) and
editing (Bulk Edit), collapse them into a single page with a toggle to swap
between "browse" and "edit" modes over the same underlying data/filter
state. Not designed — no toggle UX, no decision on what search/filter state
should or shouldn't carry across the toggle, no confirmation that the two
pages' data-fetching actually share enough to make this cheap rather than
just visually tidier.

This is a bigger, riskier change than a logic-level unification (merging two
pages' UI/routing, not just deduplicating a shared helper), so it stays
deferred past V1 regardless of what the in-flight bug investigation finds.
If that investigation turns up a genuine shared root cause in the species-
vs-form logic itself, that's independent evidence worth folding in here when
this is eventually designed — but it doesn't change the V1 scope call.

## Open items carried forward

- Whether `form_background_personal` assuming every background is possible
  on every form (rather than modeling real legality) causes any actual UI
  problems worth revisiting later. Still open — background tracking UI is
  dormant until real background data exists (see `docs/v1-roadmap/`'s V1.x
  outlook).
