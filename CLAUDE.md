# PoGo Buddy

## What this is
A local-only Android app (Capacitor-wrapped web app, sideloaded APK) for
tracking a Pokémon GO living dex — the first phase of a broader "Pokémon GO
companion app" I intend to grow over time (future phases may include things
like in-game achievement tracking, leveling optimization, etc. — **explicitly
out of scope for v1**, mentioned only so the architecture isn't needlessly
painted into a dex-only corner). Runs fully offline. No backend, no accounts,
no network calls at runtime. All personal data stays on the device forever.
Don't refer to this project as a "dex app" — it's the dex-tracking phase of
a companion app.

Note for architectural awareness, not implementation: not all in-game
achievements are dex-derived — e.g. Pokémon GO has achievements like total
trade distance (10,000,000 km) that have nothing to do with species/forms
caught. When this eventually grows beyond dex-tracking, that future data
won't fit the `species`/`form` reference tables at all — it'll need its own
independent tables (e.g. a generic `stat` or `achievement` reference table
unrelated to any Pokémon). Nothing to build now; just don't design the
personal/reference split in a way that assumes every future fact is a
per-species boolean, since it won't be.

## Platform
- Capacitor project targeting Android only (no iOS).
- Distributed as a sideloaded `.apk` — not the Play Store.
- Assume the Android SDK, Gradle, and JDK are already installed locally; do not
  scaffold Android Studio setup steps.
- Build and iterate via Capacitor's CLI / Gradle directly rather than assuming
  the Android Studio GUI is open.

## Storage
- **SQLite on-device** via `capacitor-community/sqlite`. No IndexedDB, no
  browser storage — this is a native-wrapped app, so there's no reason to
  target browser-only APIs.
- Two logical groups of tables, separated so that app updates can never
  destroy user data:
  - **Reference tables** — the Pokédex itself (species, forms, mega variants,
    types, regions, backgrounds). Wholesale replaceable on every update. The
    app owns this data, not the user.
  - **Personal tables** — the user's own achievement state. Never written by
    an update, only by user interaction.
- Every reference row has a **permanent, immutable slug** as its primary key
  (e.g. `bulbasaur-standard-male`, `charizard-mega-x`), generated once and
  never reused or reassigned across versions. Personal-data rows reference
  reference rows by this slug (foreign key). This is what makes reference-table
  replacement safe — as long as slugs are stable, updating the dex never
  orphans a user's data.
- All achievement/personal facts are **real boolean columns**, not list
  values or JSON blobs. This was a deliberate reversal from an earlier
  Obsidian-based design that used list properties — that pattern existed
  only to work around Markdown frontmatter's limits and isn't idiomatic for
  a real relational schema. Combined milestones (e.g. a shiny + perfect-IV
  individual, i.e. "shundo") are **independently stored facts, never
  computed from other booleans** — two independently-true flags (e.g. owns
  *a* shiny, owns *a* hundo) do not imply the same individual was both, so
  the combined fact must be its own column, entered/verified independently.
- Include a small schema-version table and a migration runner for personal
  data, so future additions to the personal schema can run a one-time
  migration on load without touching reference data.

## Suggested schema (starting point, not a mandate)

This is a reasoned proposal reflecting how the game's mechanics actually
work, not a fixed spec. If you (Claude Code) notice something that would be
better modeled differently — a missing edge case, a normalization that
doesn't hold, a game mechanic this gets wrong — propose the change and ask
rather than silently deviating or silently complying. I'd rather be asked
than have you guess.

```
REFERENCE (replaceable wholesale on every update, keyed by permanent slug)

species
  slug PK, dex_number, name, family_slug,
  gen, rarity (standard | legendary | mythical | ultra_beast),
  region_slug FK -> regions,
  has_male bool, has_female bool,   -- both false = genderless/unknown (e.g. Ditto)
  can_mega_evolve bool              -- mega is species-wide, never form-specific
                                     -- (confirmed: shadow Pokémon can never
                                     -- mega regardless of species — this is
                                     -- a universal game rule, not per-species
                                     -- data, so it's enforced in app logic
                                     -- rather than needing its own flag)

regions
  slug PK, name

types
  slug PK, name

backgrounds
  slug PK, name

form                     -- one row per catchable form/costume/gigantamax,
                          -- SPLIT BY GENDER: every species with has_male
                          -- and/or has_female true gets separate form rows
                          -- per gender per form/costume (not just visually
                          -- distinct species — split everything, per
                          -- decision to prioritize DB-cheap completeness
                          -- over Obsidian-era tedium)
  slug PK, species_slug FK,
  form_name, costume_name (nullable),
  gender (male | female | unknown),
  evolves bool,           -- varies per form (costumes often can't evolve;
                           -- this is separate from mega, which doesn't vary)
  shiny_available bool,
  shadow_available bool,
  dynamax_available bool,
  regional_exclusive bool,
  image_ref

form_types                -- many-to-many (dual typing)
  form_slug FK, type_slug FK

mega_variant               -- one row per (species, X/Y/Primal) that's real
  slug PK, species_slug FK, variant (X | Y | Primal | null)


PERSONAL (never touched by reference updates)

species_personal
  species_slug FK/PK,
  registered, xxl, xxs, purified              -- bool

form_personal
  form_slug FK/PK,

  caught bool,
  floor bool,                    -- lowest possible IV for a NORMAL catch —
                                  -- usually 0/0/0, occasionally raised on
                                  -- some legendaries. NOT assumed to mean
                                  -- literal 0/0/0.
  four_star bool,
  shundo bool,                   -- independently stored, see note above

  lucky bool,
  lucky_floor bool,               -- lowest possible for lucky (~10/10/10,
                                   -- verify exact value, not load-bearing)
  lucky_four_star bool,
  lucky_shundo bool,

  shadow bool,
  shadow_floor bool,              -- lowest possible for shadow — 0/0/0
                                   -- typically, raised floor on some
                                   -- raid-sourced shadows
  shadow_four_star bool,
  shadow_shundo bool,

  dynamax bool,
  dynamax_floor bool,
  dynamax_shiny bool,
  dynamax_four_star bool,
  dynamax_shundo bool,

  lucky_dynamax bool,
  lucky_dynamax_floor bool,
  lucky_dynamax_shiny bool,
  lucky_dynamax_four_star bool,
  lucky_dynamax_shundo bool,
  -- No shadow_dynamax combos anywhere — mutually exclusive in-game
  -- (confirmed). No shadow-mega either (confirmed) — shadow rows never
  -- get paired with mega_personal at all.

  best_shiny TEXT,               -- freeform user-entered value, e.g. "98%".
  best_non_shiny TEXT,           -- NOT derived from the booleans above —
  best_lucky TEXT                -- lets the user log "already have a 98%,
                                  -- not worth re-hunting" without that being
                                  -- a formal achievement tier of its own.

form_background_personal      -- junction: which backgrounds you own on
  form_slug FK,                -- which forms. Row existing = you own that
  background_slug FK,          -- form with that background. No legality
  PK (form_slug, background_slug)  -- table — every background is assumed
                                     -- possible on every form for now,
                                     -- known to be inaccurate but treated
                                     -- as acceptable simplification.

mega_personal
  mega_variant_slug FK/PK,
  evolved bool, shiny_evolved bool
```


## Reference data ingestion
- Ship a `reference.json` file as a bundled app asset (lives in this
  project's own git repo, versioned normally — no external host).
- I (the user) have a partial dataset already — likely a good chunk of
  species/forms but not guaranteed complete or fully detailed. Build the
  ingestion path to be tolerant of missing optional fields rather than
  assuming a complete dataset.
- On app start, if the bundled reference data's version is newer than what's
  stored, wipe and reload only the reference tables (upsert by slug),
  leaving personal tables untouched.
- Include a small "coverage report" dev tool/view — a way to see which
  species are missing key fields (types, region, availability flags) — since
  the dataset's completeness isn't fully known yet and will be filled in
  incrementally.

## Features

### 1. Completion / progress stats (the primary feature — this is the main
reason the app exists, more than the declutter engine below)

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

### 2. Manual search-string builder
Tri-state toggle UI (off → include → exclude → off) across standard PoGo
search criteria (star tiers, shiny, lucky, shadow, purified, costume,
legendary, mythical, ultra beast, favorite, dynamax, gigantamax). Live-builds
a valid PoGo search string using real operators: `&` = AND, `,` = OR,
`!` = NOT. Live match count against personal data as a sanity check.

### 3. Auto-declutter engine
A set of configurable rules, each of which:
- Tests a species' `form_personal` row (typically its default/standard form)
  for a trigger condition (e.g. `four_star = true`).
- If triggered, defines what's safe to clear for that species (e.g. exclude
  4★, target 1–3★ instead).

Default starter rules: already-have-4★, already-have-floor (lowest possible
IV), already-have-shiny, already-have-lucky. Should be easy to add more
without touching the query layer.

**Also a core reason this app exists over Obsidian Bases:** species must be **grouped by which rule matched them**, and
within each group, **combined into a single search string** — species dex
numbers/names OR'd together via `,`, sharing one AND'd exclusion clause. E.g.
if Bulbasaur, Venusaur, Pikachu all have a banked 4★, the output is one
string like:
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

### 4. Data entry
Fast mobile-first checklist/toggle UI per species/form — this needs to be at
least as fast as tapping properties in Obsidian, since that's the UX bar
being replaced. Prioritize this over visual polish.

## Explicitly out of scope for v1
- No networking, sync, accounts, or multi-device support of any kind.
- No trade-matching feature — that's just two people opening the app on
  their own phones side by side. Don't build anything for it.
- No iOS target.

## Open items to flag back to me as you go
- Whether the bundled reference dataset I provide needs restructuring to fit
  the schema above, or can be ingested close to as-is.
- Actual priority order for the multi-rule-match case in the declutter
  engine, when a species matches more than one rule at once.
- Whether `form_background_personal` assuming every background is possible
  on every form (rather than modeling real legality) causes any actual UI
  problems worth revisiting later.
