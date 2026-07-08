# Feature specs

Full design specs for the app's features. CLAUDE.md points here; README.md has
a shorter user-facing summary of what's shipped. Where a feature is already
built, the code is the source of truth — these specs capture the *intent* and
the design constraints that must survive refactors.

## 1. Completion / progress stats

The primary feature — the main reason the app exists, more than the declutter
engine below.

Build a general-purpose completion system with two independent axes, rather
than hardcoding per-region views:

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
  (i.e. every `form_personal.caught = true` where `costume_name IS NULL`)
- **Costume-complete** — every released costume owned, per species or per
  region
- **Achievement-complete, parameterized by column** — every species in
  scope has a given `form_personal` boolean true (e.g. "all of Kanto has a
  shiny," "all of Kanto has a lucky," "all of Kanto has a shundo"). Should
  work generically against any boolean column in `form_personal`, not be
  hand-built per achievement type.

Concretely, this needs to answer things like: "is all of Kanto registered,"
"is all of Kanto form-complete (every non-costume form owned)," "is all of
Kanto's costumes complete," "is all of Kanto lucky," each as a %-complete
number with a drill-down list of what's missing — plus the same four
questions scoped to a single species instead of a region (this is what
makes the Unown/Deoxys case work: same lens, scope is just narrower).

Implement as parameterized SQL queries (scope + lens as inputs), not as
one-off queries per region or per achievement type — the number of
regions/achievement columns will grow and shouldn't require new query code
each time.

## 2. Manual search-string builder

Tri-state toggle UI (off → include → exclude → off) across standard PoGo
search criteria (star tiers, shiny, lucky, shadow, purified, costume,
legendary, mythical, ultra beast, favorite, dynamax, gigantamax). Live-builds
a valid PoGo search string using real operators: `&` = AND, `,` = OR,
`!` = NOT. Live match count against personal data as a sanity check.

## 3. Auto-declutter engine

A set of configurable rules, each of which:
- Tests a species' `form_personal` row (typically its default/standard form)
  for a trigger condition (e.g. `four_star = true`).
- If triggered, defines what's safe to clear for that species (e.g. exclude
  4★, target 1–3★ instead).

Default starter rules: already-have-4★, already-have-floor (lowest possible
IV), already-have-shiny, already-have-lucky. Should be easy to add more
without touching the query layer.

**Also a core reason this app exists over Obsidian Bases:** species must be
**grouped by which rule matched them**, and within each group, **combined into
a single search string** — species dex numbers/names OR'd together via `,`,
sharing one AND'd exclusion clause. E.g. if Bulbasaur, Venusaur, Pikachu all
have a banked 4★, the output is one string like:
```
1,3,25&!4*&1*,2*,3*
```
not three separate strings. Species matching *different* rules produce
separate grouped strings (since their exclusion clauses differ), but species
matching the *same* rule must be merged into one. This cross-row reduce is a
SQL `GROUP BY` + string aggregation query — implement it as such, not as
in-memory JS looping, so it stays fast as the dataset grows.

Decide and document a clear priority order for species that match multiple
rules simultaneously (e.g. has both a hundo and a shiny) — don't leave this
implicit.

## 4. Data entry

Fast mobile-first checklist/toggle UI per species/form — this needs to be at
least as fast as tapping properties in Obsidian, since that's the UX bar
being replaced. Prioritize this over visual polish.

## Open items to flag back

- **(Resolved)** Whether the bundled reference dataset needs restructuring to
  fit the schema, or can be ingested close to as-is — the dataset is now
  ingested (see `INGESTION_PROGRESS.md`).
- Actual priority order for the multi-rule-match case in the declutter
  engine, when a species matches more than one rule at once. Still open — the
  declutter engine isn't built yet.
- Whether `form_background_personal` assuming every background is possible
  on every form (rather than modeling real legality) causes any actual UI
  problems worth revisiting later. Still open.
