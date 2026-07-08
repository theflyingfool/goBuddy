*Part of the [V1 Roadmap](README.md). Previous: [Theme 2 — Reference-data corrections](02-reference-data-corrections.md). Next: [Theme 4 — Performance & first impressions](04-performance-first-impressions.md).*

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
