# Planned — specced, deferred past the next release (V1.x+)

Full design specs for features that are fully thought through but not yet
being built — nothing tracks their implementation in `docs/v1-tasks/` yet,
so this doc is their only home. Deferring them past the next release is a
deliberate scope decision (see `docs/v1-roadmap/workplan.md`'s "Deliberately
NOT in V1" section): the parameterized-query pattern and boolean-column
schema that [current.md](current.md)'s stats feature already uses are
exactly what both of these need, so the deferral doesn't paint the
architecture into a corner.

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
```
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

## Open items carried forward

- Whether `form_background_personal` assuming every background is possible
  on every form (rather than modeling real legality) causes any actual UI
  problems worth revisiting later. Still open — background tracking UI is
  dormant until real background data exists (see `docs/v1-roadmap/`'s V1.x
  outlook).
