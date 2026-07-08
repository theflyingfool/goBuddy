# PoGo Buddy — V1 Roadmap & Studio Review Report

*Produced 2026-07-06 by a six-specialist virtual studio review. Each specialist
independently reviewed the entire project before any synthesis: **Product
Management & Release Planning**, **UX/UI Design & Accessibility**, **Frontend
Architecture & Performance**, **Android/Platform & QA**, **Pokémon / Pokémon GO
Domain**, and **Documentation (user / admin / dev)**. Findings below are
attributed like "(Product, Platform)" where multiple reviewers converged
independently — convergence is the strongest signal in this report.*

*Honesty note on method: reviewers worked from a full read of the code, docs,
and data, plus targeted web verification of game facts. Nothing was executed on
a real device; where a finding depends on real-hardware behavior (first-boot
timing, Android backup restore), it's framed as "test this" rather than
asserted.*

---

## Executive summary

**The product is closer to release than its release process is.** The core loop
— grid → species detail → toggle achievements → stats — is complete, works
against the full 1024-species dataset, and the data architecture underneath it
(the reference/personal table split, stable slugs, content-hash reference sync,
write queue) is genuinely better engineered than most hobby apps. Every
reviewer independently listed it as the project's top strength.

The V1 work is therefore **not restructuring**. It falls into five buckets, in
order of urgency:

1. **Delivery & data-safety netting** — the app currently ships as a
   debug-signed APK with no release keystore, no recovery path when the
   database fails to open, silently-swallowed write failures, and no backup
   story beyond a manual Export button nobody is told to press. Several of
   these are one-bad-day-from-total-data-loss scenarios for a friend.
2. **A reference-data correction pass, done *before* anyone installs for
   real** — the domain review found wrong slugs and phantom forms that are
   trivial to fix today but become permanent migration debt the moment a real
   device holds personal data keyed to them (slugs are immutable by design).
3. **The two committed V1 features, re-scoped by what the review found** —
   the Gigantamax field is likely *already done* (as form rows, a better
   shape), turning it into a decision + small UI cleanup; the Mega tracking UI
   is *bigger* than "just UI" (repository methods, export format, and a
   reference-data fix must come first).
4. **Legibility for people who didn't build it** — the single biggest UX theme.
   Cryptic filter glyphs with no legend, an unsearchable 188-form Pikachu page,
   disabled pinch-zoom, and real contrast failures all share one root cause:
   the app currently assumes the author's mental model.
5. **Documentation & release process** — user docs for friends don't exist at
   all, the ingestion runbook lives inside an incident postmortem, and the
   status doc (TODO.md) contradicts the shipped schema.

Deferring the search-string builder and declutter engine is architecturally
safe — the parameterized-query pattern and boolean-column schema are exactly
what they'll need. One cheap insurance item now: write the declutter engine's
*safety clause* into its spec before it's forgotten (§ "Deferred features").

---

## What V1 means (confirmed scope)

Decided with the owner before this review ran:

- **Audience:** the owner plus a few friends, via a shared sideloaded APK.
  Friends are serious Pokémon GO players, not developers, and will never read
  the repo. Real user docs and a sane first-run experience matter;
  contributor-grade polish does not.
- **In V1:** Mega evolution tracking UI, and a distinct way to track "I own a
  Gigantamax individual" (see re-scoping below — this may already exist).
- **Deferred past V1:** the tri-state search-string builder and the
  auto-declutter engine. They're the headline of a later release; V1 must not
  paint them into a corner (it doesn't — see "Deferred features").
- **Desktop:** "runs on a computer" stays, packaging was an open question —
  this report recommends an answer (§ "Desktop story").
- **Hard constraints:** local-only (no runtime network, no accounts, no sync),
  Android + computer. Everything else — including the database schema — was
  treated as challengeable.

---

## Strengths worth protecting (unanimous or near-unanimous)

These are load-bearing; future work should not regress them.

- **The reference/personal split, executed correctly.** Reference data (the
  Pokédex itself) can be wholesale replaced on update without touching personal
  data, because personal rows point at reference rows by permanent slug IDs.
  The sync wipes reference tables inside a single database *transaction* (an
  all-or-nothing group of changes) and applies registered slug renames first.
  (All reviewers)
- **Combined milestones stored, never computed.** "Shundo" (shiny + perfect
  IVs on the *same individual*) is its own stored fact, not inferred from two
  separate flags. The domain reviewer called this out as the thing naive
  trackers always get wrong. Impossible combos (lucky-shadow, shadow-mega,
  shadow-dynamax) are correctly absent. (Domain, Architecture)
- **Single-source-of-truth field lists.** The 25 achievement fields are defined
  once in `src/db/types.ts` and drive the SQL, the UI groups, the cascade
  rules, and the export format — adding a field touches few places. (Architecture)
- **The cascade is the best data-entry idea in the app** — checking "Shundo"
  auto-checks shiny/4★/caught/registered. It's what actually beats the Obsidian
  tapping-speed bar. (UX)
- **Native-element discipline.** Real `<button>`, real checkboxes in labels,
  real `<details>` — an unusually good accessibility floor for hand-rolled DOM;
  most a11y fixes below are additive, not rewrites. (UX)
- **Honest engineering culture** — corrected predictions, deliberate non-fixes
  called out, real bugs found by real testing and written down. The
  documentation reviewer called TODO.md's incident write-ups "a model
  postmortem." Keep that habit; just relocate it (§ Documentation).

---

## Theme 1 — Data safety: the V1-blocking cluster

This app's entire value is one SQLite file on a phone. The review found five
distinct ways that file (or a friend's trust in it) can currently be lost, and
none require exotic circumstances.

### 1.1 The signing keystore is a data-loss time bomb *(Product, Platform — both ranked it #1)*

Android will only install an app *update* if it's signed with the same
cryptographic key as the installed version. Today every APK is a **debug
build**, signed by an auto-generated key that lives in one file on one machine
(`~/.android/debug.keystore`). If that machine is reinstalled, replaced, or the
file is lost, no future APK can update any friend's install — their only path
is uninstall → reinstall, **which deletes the database**. All the careful
migration machinery is downstream of this one unversioned file, and nothing in
the repo mentions it.

**Fix (S):** generate a dedicated release keystore once; back it up in at least
two places (committing it to this private repo is a defensible choice — decide
deliberately); add a `signingConfigs.release` block to
`android/app/build.gradle` and ship `assembleRelease` builds from now on.
First friend install should already be release-signed.

### 1.2 Two boot-brick scenarios with no way out *(Platform, Architecture)*

"Boot-brick" = the app shows *"Couldn't open the on-device database. Try
reloading."* forever, and because Export lives behind a successful boot, the
user can't even rescue their data.

- **Removed slug → sync failure.** The reference sync defers *foreign-key*
  checks (the database rule that a personal row must point at an existing
  reference row) until the transaction commits. If a slug is ever **removed**
  from `reference.json` (not renamed via the registry) while someone's personal
  data references it, the commit fails, the sync throws, and every subsequent
  boot fails the same way. This isn't hypothetical: known-bogus rows (the fake
  Galarian Persian/Grimer/Muk) are natural candidates for deletion in a future
  data pass. One friend who toggled a bogus form + one cleanup commit = bricked
  install. (`src/db/reference-sync.ts:65`)
- **A failed migration mid-run.** A *migration* is a script that upgrades the
  database's structure in place. The runner (`src/db/migrations.ts:54-57`)
  doesn't wrap each migration in a transaction: on native Android a crash
  halfway leaves the database half-upgraded with the old version number, so the
  next boot re-runs the migration, hits "duplicate column," and fails forever.
  The `MIGRATIONS` list is empty today — this must be fixed *before* the first
  real entry ships, whenever that is.

**Fixes (S each):**
- In the sync transaction, detect personal rows whose slug no longer resolves
  and quarantine them (move to an `orphaned_personal` table) instead of letting
  the commit fail; add an ingestion-time check that fails the build if a slug
  disappears without a rename-registry entry.
- Wrap each migration in a transaction; refuse to boot (with a clear message)
  if the stored schema version is *newer* than the app's (someone sideloaded an
  old APK); dump personal tables to JSON before running any pending migration.
- **A boot-failure rescue screen**: on any DB-open/sync/migration error, still
  offer a raw "export personal data" button that reads the personal tables
  directly. This one screen turns every scenario above from catastrophic into
  annoying. The platform reviewer's summary line: *"every other risk is
  recoverable if the keystore and the rescue path exist."*

### 1.3 Silent write failures: the UI lies *(Architecture, Product, Platform — all three found it independently)*

Every edit updates an in-memory copy immediately (so the UI shows it saved) and
writes to the real database asynchronously through a queue. If that write fails
— disk full, I/O error, a foreign-key violation — the only symptom is
`console.error`, which nobody sees on a phone
(`src/data/sqlite-repository.ts:96-98`). The toggle looks saved, survives the
session, and vanishes on next launch. Bulk edits have a variant: a mid-batch
failure still commits the partial batch.

**Fix (S):** on the first failed write, show a persistent in-app banner ("Your
last change didn't save — export a backup now") with a retry; make import
report the number of rows it skipped (see 1.4).

### 1.4 Import can silently drop data, and has no undo *(Platform, Product, Architecture)*

Import overwrites matching entries with only a confirm dialog as the guard —
no automatic pre-import snapshot. Worse: an export from a *newer* app version
can contain form slugs this build doesn't know; each such row fails its
foreign-key check inside the silent write path above, so the user sees
"Imported." while rows quietly vanish. Phone and desktop *will* drift versions
— this is the exact workflow the feature exists for.

**Fix (S):** auto-export a snapshot before applying any import (the function
already exists — call it first); pre-filter unknown slugs and report the count;
surface write failures per 1.3.

### 1.5 No backup story beyond a button nobody is told about *(Docs, Platform, Architecture)*

- On desktop/web, the entire database lives in the browser's IndexedDB —
  storage the browser is allowed to **evict** (delete) under disk pressure.
  `navigator.storage.persist()` — a one-line request that asks the browser to
  protect the data — is never called.
- On Android, `allowBackup="true"` is the untested scaffold default; whether
  Google's auto-backup actually restores a sideloaded app's DB has never been
  verified.
- Nothing in the app or docs tells a friend that Export is their only real
  backup.

**Fixes (S–M):** call `storage.persist()` on web; a once-daily rotating
auto-export on Android (keep last 3, via the already-integrated Filesystem
plugin) is the proportionate net; add "why you should export" text next to the
button; decide the `allowBackup` stance deliberately and document it.

---

## Theme 2 — Reference-data corrections: do these *before* first real install

Slugs are permanent by design — fixing a wrong slug after real personal data
exists means a slug-rename registry entry forever. Fixing them now is free.
The domain reviewer verified time-sensitive game facts by web search.

**Ship-stopping (all S–M, mostly ingestion-script work):**

1. **Necrozma's fusion names are swapped**: the data says "Dawn Mane" / "Dusk
   Wings"; the real forms are **Dusk Mane** (Solgaleo fusion) and **Dawn
   Wings** (Lunala fusion). Both are in GO. The single most embarrassing string
   in the dataset for a serious player.
2. **Phantom "Standard" forms on ~15 multi-form species.** The Unown fix
   (species-header row isn't a real form) needs extending to at least: Deoxys,
   Giratina, Shaymin, Zygarde, Hoopa, Genesect, Basculin, Oricorio, Sinistea,
   Urshifu, Enamorus, Furfrou, Vivillon, Maushold, Dudunsparce. Each phantom
   inflates the Form-complete denominator (the count a percentage is measured
   against) and shows a catchable that doesn't exist ("Giratina has 3 forms").
   Note: the shiny flag often sits on the phantom row — it must migrate to the
   real default form when the phantom is removed. Mechanism already exists:
   `NO_STANDARD_FORM_NAMES` in `scripts/ingest/pokemon-facts.ts`.
3. **Gen-9 slug typos + one wrong dex number**: `ogrepon` → Ogerpon,
   `fezanipiti` → Fezandipiti, `sinistchai` → Sinistcha **at dex 1013, not
   1012** (it currently duplicates Poltchageist's number). Also "Pharoah" →
   "Pharaoh" (display name).
4. **Crowned Sword Zacian / Crowned Shield Zamazenta are missing** — in GO
   since GO Fest 2025, two of the most chased entries in the current game.
5. **Six megas missing that ARE in GO**: Mega Pidgeot, Mega Kangaskhan, Mega
   Mewtwo X, Mega Mewtwo Y, Primal Kyogre, Primal Groudon. TODO.md already
   suspected five as "stale tracker data"; the domain review confirms all six.
   The Mega dex lens is wrong by 6/50 until fixed — and this must land before
   the Mega tracking UI makes it visible.

**Correct the project's own records (V1-nice but do it while it's fresh):**

6. **"Mega Dimension" is not fan content.** TODO.md's ingestion notes call
   PokeAPI's Mega Dimension data "a non-canonical fan-content pack." It is the
   **official DLC of Pokémon Legends: Z-A** (~21 new official megas, plus more
   in the base game). Consequences: the tracker's "bogus mega-capable" flags
   for Uxie/Mesprit/Azelf/Malamar/Falinks are likely the tracker being *ahead*
   of the pipeline, not copy-paste errors (verify against Serebii's Z-A list
   before "correcting" them); and TODO.md's claim that Audino has "no official
   Mega" is flatly wrong (Mega Audino is ORAS-era; `audino-mega` is even in the
   data already). The x-y/ORAS version-group filter is still *defensible* for
   "what's in GO today" — but document it as an availability filter, not a
   fake-data filter, and plan its removal for when Z-A megas reach GO.
7. **The ~11 unresolved costume codes — identified.** Cap Pikachu `O` =
   Original Cap, `W` = World Cap (high confidence; other letters follow
   Bulbapedia's Hoenn/Sinnoh/Unova/Kalos/Alola/Partner scheme). `Fly` = Flying
   Pikachu, yellow balloons (4th anniversary 2020); `Fly5` = "5"-shaped
   balloons (5th anniversary 2021); `FlyOkinawa` = Okinawa tourism promo
   (2022); `FlyGreen/Purple/Orange/Red` = balloon-color variants from the
   5th-anniversary era (the *what* is certain, exact per-color event
   attribution is medium confidence). Suggested display: "Flying (5th
   Anniversary)", "Flying (Okinawa)", etc. Confirm against Bulbapedia's sprite
   images before committing — these become immutable slugs.
8. Minor: the lucky-IV floor comment in `docs/data-model.md` says "~10/10/10";
   it's actually 12/12/12 (non-load-bearing, fix the comment).

---

## Theme 3 — The two V1 features, re-scoped by what the review found

### 3.1 Gigantamax: probably a decision, not a migration *(Architecture, Platform, Product, Domain — four independent flags)*

The confirmed scope said "add a Gigantamax personal field (schema migration +
UI)." But commit `36e5754` already remodeled Gigantamax as **distinct catchable
form rows** — so "have I caught Gigantamax Venusaur" is already answerable as
`caught` on the `venusaur-gigantamax-*` rows, with shiny/4★/shundo tracking
free. Adding a boolean field on top would double-model the same fact.

**Recommendation:** no schema change. Instead:
- **Decide the branch semantics on G-max rows** (Domain): on a Gigantamax form
  row, the "Standard: Caught" branch and the "Dynamax" branch describe the same
  physical event (every G-max catch is a Max Battle catch) — and those rows
  currently carry `dynamaxAvailable: true`, so the detail page shows redundant
  Dynamax/Lucky-Dynamax toggle groups. Hide the Dynamax groups on G-max rows
  (the `availableWhen` mechanism already exists) or document that `caught`
  means "own it."
- **Tighten G-max availability**: all 32 G-max species are marked available
  (shiny included), but GO's rollout since late 2024 is a subset and shiny
  G-max is event-gated per species. The G-max dex is small and countable — a
  serious player will notice. (Data pass, not code.)

### 3.2 Mega tracking: a vertical slice, not a bolt-on *(Architecture, Product, UX)*

"Zero UI" understates it. Today there are **no repository methods** for mega
state, boot never reads `mega_personal`, and — critically — **the export
format doesn't include it**, so shipping mega UI without extending
export/import would create tracked data that silently doesn't transfer between
phone and desktop, and an older app importing a newer file would drop it
without even a warning.

**Build order (M total):**
1. Reference-data fix first (the six missing megas, Theme 2 #5).
2. Repository surface: mega read/write methods + boot loading `mega_personal`.
3. **Extend `PersonalDataExport`** to carry `megaPersonal` (and
   `formBackgroundPersonal` while there — same hole), treating the export-shape
   change as a personal-schema-version event.
4. UI, following existing patterns (UX): a "Mega" fieldset on the species
   detail page gated on `canMegaEvolve` — one toggle pair (evolved /
   shiny-evolved) per variant, since Charizard X and Y are distinct — plus the
   stats lens and filter chip, which the generic achievement machinery gives
   nearly for free.

### 3.3 A decision that defines the app's headline number *(Product, Domain)*

"Form-complete" currently counts **every** non-costume form in its denominator:
phantom Standards (Theme 2 — fix removes those), **Gigantamax forms** (a hard
raid grind now blocks Charizard's form-completeness), and **106
regional-exclusive forms** (Vivillon patterns etc. make form-complete
effectively unattainable for every region-locked species). Nobody *decided*
this; it fell out of the modeling. Options: exclude regional exclusives (or
make it a lens option), and/or a separate "G-max-complete" lens. This is the
number the app exists to show — it needs an explicit owner decision
(`src/data/completion-stats-sql.ts:65`).

---

## Theme 4 — First impressions & on-device performance

- **~215 species (dex 810–1024) render as broken images** — `public/sprites/`
  ends at 809, there's no fallback, so all of Galar and Paldea look broken on
  day one. Source the missing art or add a graceful placeholder (`onerror`
  fallback in the grid, `src/ui/sprites.ts`). *(Product, Architecture —
  V1-blocking; the most visible defect in the app)*
- **First boot may stall for a long time on a real phone.** The reference sync
  performs ~8,100 sequential database inserts, each a JavaScript↔native bridge
  round-trip on Android — plausibly 30s–minutes behind a static "Loading your
  dex…" message, on first launch *and after every APK update that changes
  reference data*. The emulator run was "clean" but untimed. **Test on real
  hardware first** (already TODO's top item); the fix is batching
  (`executeSet`/multi-row inserts) plus a progress message.
  *(Architecture, Product)*
- **A real bug: the Bulk Edit search box loses focus after every keystroke** —
  the page rebuilds itself around the input the user is typing in
  (`src/features/data-entry/bulk-form-edit.ts:96-100`). Automated fill()-style
  testing can't see it; a human hits it immediately. *(Architecture, UX)*
- **Select-mode jank**: every tile tap in grid select-mode rebuilds all ~7-8k
  DOM nodes; expected 100–250ms visible lag per tap on a mid-range phone,
  during the highest-frequency gesture. Fix is in-place class toggling +
  debouncing the filter input — **not** virtualization (rendering only visible
  rows), which every reviewer agreed is disproportionate here. *(Architecture, UX)*
- Species detail rebuilds the whole page per checkbox toggle (thousands of
  nodes for Pikachu); build groups on first open, update only the toggled
  group. *(Architecture, UX)*

---

## Theme 5 — Legibility & accessibility: "the author's mental model is required"

The UX reviewer's synthesis: the four biggest usability issues are the same
failure wearing four hats — the app assumes you already know what you meant.

- **Filter chips and badges are unreadable to anyone else.** The always-visible
  row renders as `L M UB Mega D? G?`; "More filters" opens ~27 glyph chips like
  `🍀0`, `☾★`, `D💎`. Full names exist only as hover tooltips — **which never
  fire on touch**. There is no legend anywhere. The tri-state cycle (tap once =
  include, twice = exclude) is undiscoverable. Fix: full labels on chips (they
  wrap fine) or a tap-reachable legend, + `aria-pressed` state. **(V1-blocking)**
- **The 188-form Pikachu page is unsearchable.** The core data-entry trace
  ("caught a shiny costume Pikachu") is fine on taps but dies scanning ~38 rows
  of overview tiles for the right costume. The one page that most needs a text
  filter has none — the header search on that page *jumps to other species*
  instead. Add a form-name filter box. This is the difference between meeting
  and missing the "as fast as Obsidian" core promise. **(V1-blocking)**
- **Pinch-zoom is disabled** (`maximum-scale=1.0` in `src/index.html:5`) — a
  one-line fix, a straight WCAG failure (the Web Content Accessibility
  Guidelines baseline), and a real problem outdoors. **(V1-blocking)**
- **Computed contrast failures** (not estimates — from the actual hex values):
  the workhorse `#888` secondary text on white is 3.54:1 (AA requires 4.5:1);
  white-on-green include-chips/Apply button 3.30:1; the disabled Apply button
  is ~1.5:1 — illegible. **(V1-blocking, S)**
- **The nav drawer is broken for keyboard/screen-reader users**: when "closed"
  it's only slid off-screen — its 8 buttons stay in the tab order on every
  page. No Escape-to-close, no focus management, no `aria-expanded`. Fix with
  `inert`/`visibility:hidden` + focus handling. **(V1-blocking, S)**
- **Nav noise**: 4 of 8 destinations are stubs or the dev-facing Coverage
  Report (whose empty state tells a friend to run `npm run ingest:build`).
  Collapse stubs under "Coming later"; move Coverage Report behind Settings or
  a dev flag. **(V1-nice)**
- **Stats drill-down**: clicking a cell writes the missing-species list below
  the table with no scroll-into-view (looks like nothing happened), and the
  list is plain text, not links — already TODO's top user request; make species
  clickable to their detail pages. **(V1-nice, small, outsized daily value)**
- **Focus & announcements**: every re-render resets keyboard focus to the page
  body (keyboard entry effectively impossible); async statuses ("Computing…",
  "Imported…") are silent to screen readers — one `aria-live` region (a
  screen-reader announcement element) + focus restoration covers it. Touch
  targets (chips ~33px, stats cells ~30px) sit below Android's 48dp guidance.
  **(V1-nice)**
- **Dark mode is accidentally 90% done** — `color-scheme: light dark` is
  already set, so the app flips with the system theme, but it's unaudited
  (hardcoded tints, disabled-text colors, sprites on dark canvas). Audit +
  a manual toggle; for a game played outdoors at night on OLED phones this is
  closer to a feature than a nicety. **(V1-nice / post-V1)**
- Terminology drift worth one pass: grid "Caught/Uncaught" chips actually
  filter species-level *registered*; "Caught" elsewhere is per-form; a
  "Registered" toggle sits next to both. The gender-collapse setting silently
  writes both genders from one checkbox — needs a one-line caveat. Species
  detail shows no sprite/types/region — no visual confirmation you're on the
  right species (the types data fixed at such cost in ingestion is rendered
  nowhere in the app). **(V1-nice)**

---

## Theme 6 — Desktop story: recommendation

**Recommendation (Platform reviewer, endorsed by synthesis): the launcher
script — option (a) — hardened; revisit a packaged app only if real demand
materializes.**

Reasoning:
- The realistic desktop user is the owner, who has Node. Friends are
  phone-first; their occasional desktop need is covered by export/import in any
  browser.
- The zero-install zip **buys nothing on the axis that matters**: a bundled
  server still stores data in browser IndexedDB (same eviction risk), while
  adding per-OS packaging work to every release. Worst maintenance-to-benefit
  ratio. (Also: the built app can't just be opened as a file — `file://`
  doesn't satisfy the app's asset and WASM loading — so "just unzip and open"
  was never actually on the table.)
- A packaged app (Electron/Tauri) is the only option that genuinely improves
  durability (real on-disk SQLite), but it means a third storage backend and a
  per-release desktop pipeline for approximately one user. Post-V1 at best.

**Hardening for the launcher (all cheap):** pin the port in the script —
browser storage is keyed by origin, so `localhost:5173` and `localhost:4173`
are *different databases*, and a drifting port silently "loses" data that's
actually just under another origin; call `navigator.storage.persist()`; add a
minimal PWA manifest + service worker (an installed PWA gets its storage
protected essentially unconditionally in Chromium — materially changes the
eviction calculus for ~an hour of work). Frame desktop as a *working copy*:
export back to the phone after editing sessions; the phone is the system of
record.

---

## Theme 7 — Quality infrastructure (proportionate to a friends-audience app)

Current state: zero committed tests, no lint, no CI (automated checks that run
on every change) — all the careful Playwright verification in TODO.md was
ad-hoc and unrepeatable.

Priorities (Platform's proposal, Architecture concurring):

- **P0 — protect the data paths**: a thin adapter running the real migration +
  sync code against Node's built-in SQLite, with fixture databases: v1-DB +
  seeded personal data → migrate + sync → assert nothing orphaned. Include the
  removed-slug regression case. Export → import → deep-equal round-trip tests.
  Plus an on-device rehearsal recipe: pull the owner's real DB via `adb`
  (debug builds allow it), test every future upgrade against a copy first.
- **P1 — a committed Playwright smoke suite** (~6 scenarios already proven
  valuable manually: boot, toggle+reload persistence, stats counts,
  export/import, settings) and a CI workflow running typecheck + unit + smoke.
  Its most important job: **guarding the `sql.js` 1.11.0 pin** — the known
  boot-hang failure is exactly what a CI boot test catches, and `jeep-sqlite`
  is caret-ranged so an `npm update` can silently move its half of that ABI
  pair.
- **A slug-stability check** in the ingestion pipeline: diff new
  `reference.json` slugs against the last committed version; fail if any slug
  vanished without a rename-registry entry. This mechanizes the discipline the
  whole data-safety story depends on. (Architecture, Platform, Docs — three
  independent flags)
- **Deletions that pay rent** (Architecture): the dummy localStorage backend
  and demo seed are dead code, and the in-memory JS *stats* implementation
  exists only to serve them — deleting all three makes stats SQL-only and
  eliminates the hand-synced JS/SQL duplication rather than managing it. The
  future declutter engine then follows the same SQL-only pattern.
- Repo hygiene: **`docs/` is untracked** while committed files link to it — a
  fresh clone 404s its own architecture docs (three reviewers flagged this);
  remove the `INTERNET` permission from the Android manifest (a "no network
  ever" app should let the OS enforce it — cheap trust win); pick one name
  (PoGo Buddy vs GoBuddy vs `gobuddy-export-*.json`); move the stray 38MB APK
  out of the repo root.

---

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

---

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
  needs. **One spec fix now (S, docs-only):** write the declutter **safety
  clause** into features.md before it's forgotten — generated transfer-search
  strings must always exclude `favorite` and `specialbackground` at minimum,
  and default to protecting shiny/lucky/costume/legendary/etc.; decide the 0★
  question and the multi-rule priority order. As specced today, the example
  string would happily mark a shiny costume Pikachu for transfer. This is the
  app's scariest future failure mode and costs a paragraph to prevent.
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

---

## Addendum (2026-07-08): owner follow-up decisions

After reading this report, the owner raised four points the six-specialist
review didn't fully anticipate. Three follow-up read-only explorations (schema/
slug/mega architecture, the ingestion + runtime DB pipeline, and the owner's
`Refs from Obsidian/pogo_assets` image folder) grounded the decisions below.
**These decisions are authoritative and supersede anything above that conflicts
with them.** The full granular breakdown lives in `docs/v1-tasks.md`.

1. **Identity/slug rework — deferred to V2.** Confirmed via `scripts/ingest/slug.ts`
   and a full key dump of `reference.json`: slugs are pure display-derived text
   (`slugify(name/form/costume/gender)`), with no PokeAPI numeric ID or any other
   stable identifier persisted anywhere. The owner's typo-fear (Theme 2) is
   justified, but the fix is bigger than V1 scope. **Insight worth preserving for
   V2**: identity should likely be unified with the image-pipeline's numeric IDs
   (point 3) — Niantic's own game-master form/costume ID enum — rather than
   solving slug-stability and image-matching as two separate problems. **V1 only
   does the Theme 2 correction pass** (fix already-known-wrong slugs before any
   real install); the slug-rename registry remains the safety net for anything
   found later.
2. **Reference/personal DB file split — deferred to V2**, bundled with the
   identity rework above. Confirmed `@capacitor-community/sqlite` already
   exposes `executeSet`/`importFromJson`/`copyFromAssets` (all unused today),
   and `scripts/build-dummy-db.ts` already proves a fast prepared-statement
   bulk-insert pattern exists in this codebase — it's just not wired into the
   app's boot path. The owner agrees splitting into two physical database files
   would make safety guarantees easier (no cross-file FK coupling), but wants
   it done properly alongside the identity rework, not rushed into V1.
   **V1 contingency**: ship the safety net from Theme 1 (orphan quarantine,
   rescue screen, migration hardening) regardless of file layout; only pull the
   `executeSet`-batching fix forward into V1 if real-device testing (Phase 6)
   shows the current 8,156-insert runtime sync is actually slow enough to hurt
   the first-run experience.
3. **Image pipeline — full scope, in V1** (expands the original Theme 4 sprite
   fix). The image folder was identified as **`PokeMiners/pogo_assets`** — an
   actively-maintained git checkout of Niantic's own extracted Pokémon GO
   assets (2,213 PNGs, dex 1–867, e.g. `pokemon_icon_025_00.png`). Species-level
   matching (parse the dex number, matches the app's own `NNN.png` convention
   already) is trivial. Form/costume-level matching needs one more public
   lookup table (the game-master's numeric form/costume ID → name mapping,
   e.g. `pokemon_icon_025_00_11.png` = a specific Pikachu costume) — a solved,
   documented problem, not manual per-image curation. The owner wants this
   done fully: **each form should show its correct costume art in V1**, not
   just a species-level fallback. This wires the already-reserved-but-unused
   `form.imageRef` column for the first time.
4. **The UI needs a real visual design pass, not just accessibility patches.**
   The owner: *"We need a more professional UI from day one."* Confirmed as its
   own V1 workstream, sequenced **before** Theme 5's contrast/legibility fixes
   so those fixes land once against a deliberately-designed visual system
   (palette, type pairing, spacing/layout) instead of being redone after a
   later redesign. Theme 5's specific findings (cryptic chips, unsearchable
   188-form page, drawer accessibility, etc.) remain valid and still ship — they
   just execute against the new visual system, not the current one.

---

## Open questions for the owner

Collected from every reviewer; D1–D7 in the workplan are the blocking ones.
Additional non-blocking asks:

1. The `001-Bulbasaur/Standard.md` Obsidian-refs question (may contain real
   personal progress) — still unresolved; decide before ever deleting that
   folder. (Carried from TODO.md)
2. Whether to verify the five "bogus mega-capable" tracker flags
   (Uxie/Mesprit/Azelf/Malamar/Falinks) against the Z-A mega list before the
   next ingestion pass "corrects" your own data. (Domain)
3. Whether the ~65 unverified-genderless species and 385 inherited-availability
   forms warrant a manual pass before V1 or ride as known caveats (reviewers
   lean: ride, they're honestly flagged in Coverage Report).

---

## Coverage map (requested roles → where addressed)

| Requested role | Where covered |
|---|---|
| Product management | Exec summary, Themes 3, 4, 8; workplan |
| UX/UI design | Theme 5; Themes 3.2, 4 |
| Frontend architecture | Themes 1.2–1.3, 3.2, 7; "Deliberately NOT in V1" |
| Android/PWA experience | Themes 1.1, 1.5, 4, 6; Phase 6 |
| Pokémon domain | Theme 2; V1.x/V2 outlook |
| Pokémon GO domain | Themes 2, 3.1, 3.3; declutter safety clause |
| QA | Theme 7; Phase 6 |
| Accessibility | Theme 5 |
| Performance | Theme 4; "Deliberately NOT in V1" |
| Release planning | Themes 1.1, 8; Phases 0, 6; D4–D6 |
| User documentation | Theme 8 (friends); Phase 5 |
| Admin documentation | Theme 8 (operator); ingestion runbook |
| Dev documentation | Theme 8 (developer); Theme 7 hygiene |
