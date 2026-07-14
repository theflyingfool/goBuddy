*Part of the [V1 Task Breakdown](README.md). Previous: [2. Data-safety net](02-data-safety-net.md). Next: [5–6. Mega & Gigantamax](04-mega-and-gigantamax.md).*
*Roadmap context: [Addendum, point 4](../v1-roadmap/addendum.md).*

## 3. Visual identity pass (new — do this before § 4)

*The owner: "We need a more professional UI from day one." This is real
design work — not pre-decided in this planning pass.*

- [x] Ensure we have a responsive UI: on a desktop / tablet we should be
  using most of the space not limiting to a "phone" — `#app`'s hard
  `max-width: 480px` (which pinned every screen to a narrow centered phone
  column regardless of actual viewport) now widens to `min(1100px, 94vw)`
  above a 720px breakpoint; phones are unaffected since 480px was already
  wider than any real phone viewport. The species grid, stats table, etc.
  reflow into more columns/space automatically since they're already
  responsive grids, no per-component change needed. **Update (mobile
  ergonomics redesign, see bottom of this file):** the hamburger-triggered
  overlay drawer candidate follow-up mentioned here is now done — nav is a
  bottom tab bar on phone / a persistent left sidebar `>=720px`, both driven
  by this same breakpoint.
- [x] We are correctly defaulting to dark mode, but this should be a toggle —
  Night Studio is dark-first (dark is the primary design, light a fully
  hand-tuned second theme, not an inversion), and it's now overridable:
  Settings → Appearance → System/Light/Dark (see the dark-mode-audit bullet
  below for the toggle's implementation). **Note the actual default is
  "follow the OS," not "force dark"** — a phone set to light mode still
  opens light by default until the user flips the toggle. Flagging this
  explicitly since "we are correctly defaulting to dark mode" could also
  have meant hard-coding dark regardless of OS setting; the toggle covers
  either intent, but which one *ships as the out-of-the-box default* is the
  owner's call to confirm.
- [x] The stats page should look like a well done powerBI dashboard or
  similar — owner confirmed the underlying data/queries didn't need to
  change, just the presentation. Added a headline KPI-card row above the
  region table (`.stats-kpi-row`/`.stats-kpi-card` in `src/style.css`,
  `renderKpiCard` in `src/features/stats/stats-page.ts`): one big-number
  card per selected lens, pulled straight from the existing "All regions"
  scope row (no new query). Replaced the missing-species drill-down's
  comma-joined text blob with a tappable sprite grid
  (`.stats-missing-grid`/`.stats-missing-tile`) that navigates straight to
  a species' detail page on tap — this also knocks out §4's stats
  drill-down item below (scrollIntoView + species-name links), since it's
  the same code path.
- [x] Define the visual direction: pitched 3 candidate directions (Field
  Ledger, Night Scan, Studio Neutral) as a live mockup artifact applied to
  real screens (header/search, species grid + chips, detail toggles) in both
  light and dark. Owner picked a merge — Night Scan's palette carried by
  Studio Neutral's layout — refined into one named direction, **"Night
  Studio"**: dark-first ink-blue ground (`#0c1220`/`#131b2c`), single teal
  accent (`#3fd1c4` dark / `#0b756c` light — darkened from the initial pitch
  after a contrast pass, see below), soft 10px radii, hairline borders,
  sentence-case type at weight 650 for headings, monospace
  (`ui-monospace`/`SF Mono`/`Menlo`) reserved for actual numeric data (dex
  numbers via a new `.dex-num` span, stats percentages) rather than an
  all-caps HUD treatment. System font stacks throughout, no bundled webfont —
  deliberate, since this ships inside a sideloaded APK where every extra font
  is dead weight on the phone forever.
- [x] Apply the system to the app shell: `src/style.css` now defines the full
  token set (`--bg`/`--surface`/`--surface-2`/`--ink`/`--muted`/`--line`/
  `--accent`/`--on-accent`/`--positive`/`--negative`/radii) at `:root`,
  re-themed under `@media (prefers-color-scheme: dark)` and mirrored in
  `:root[data-theme="dark"]`/`[data-theme="light"]` for the manual override
  below. Every rule in the stylesheet now reads tokens — no more `canvas`,
  `#8886`-style literals, or the old ad hoc `#2563eb`/`#16a34a`/`#dc2626`.
  `src/app-shell/header.ts` and `nav-drawer.ts` needed no structural changes,
  just picked up the new tokens through their existing classes.
- [x] Apply to the species grid: tiles, filter chips, filter bar
  (`src/features/data-entry/species-grid.ts`) — same token pass; dex numbers
  in tile labels split into a `.dex-num` span for the monospace treatment.
- [x] Apply to species detail: fieldsets, form groups, overview grid
  (`src/features/data-entry/species-detail.ts`) — same, plus the detail
  header's `#dex name` split into `.dex-num`.
- [x] Apply to the stats page: table, progress bars
  (`src/features/stats/stats-page.ts`) — `.stats-cell-text` (the
  `complete/total (pct%)` readout) now uses the monospace/tabular-nums
  treatment.
- [x] Apply to Settings (`src/features/settings/settings-page.ts`) — also
  where the new theme toggle lives (see below).
- [x] Dark-mode audit against the new system — `color-scheme: light dark` is
  already set (`src/style.css`); both themes were hand-tuned together (not a
  naive invert) and checked with a WCAG contrast script rather than eyeballed
  (no Chrome/browser available in this working environment to visually
  verify — flagging that explicitly rather than claiming a look I couldn't
  actually see). That check caught two real issues in the initial pitch's
  hex values before they shipped: the light-mode accent (`#0e8a80`) only hit
  3.75:1 against its background (below the 4.5:1 AA text threshold) —
  darkened to `#0b756c` (4.94:1+). And the pre-existing green/red
  include/exclude colors turned out to fail contrast when reused as plain
  text (e.g. `.bulk-current`) vs. as white-on-fill buttons — those are now
  two separate token pairs, `--positive`/`--on-positive`/`--negative`/
  `--on-negative` (fill+text, single value, since the button's own
  background makes the page theme irrelevant) vs. `--positive-text`
  (theme-tuned, since that one *is* read directly against the page/card
  surface). Added the manual override toggle: Settings → Appearance →
  System/Light/Dark, backed by `src/app-shell/theme.ts`
  (`getThemePreference`/`setThemePreference`/`applyTheme`), stamping
  `data-theme` on `<html>`; applied on boot in `main.ts` right after the repo
  opens.

---

## 4. Legibility & accessibility polish (after § 3)

- [x] Chip legibility: full labels or a tap-reachable legend for the
  filter chips (currently glyph-only with hover-only tooltips); add
  `aria-pressed` for tri-state chips (`src/features/data-entry/species-grid.ts`,
  `src/features/data-entry/indicator-labels.ts`). **`aria-pressed` done**
  (plus an `aria-label` stating include/exclude/off, since a screen reader
  can't see the ✓/✕ suffix glyph) — every filter-chip-style toggle across
  the grid and bulk-edit now reports its state. **Full labels/legend for
  sighted users not done** — that's a visual/layout call (how much room do
  chips get before they wrap awkwardly?) I didn't want to make blind; see
  the roughness-review notes below.
  **Scoping pass (2026-07-13)**: chips are built by `fieldFilterChip()`
  (`species-grid.ts`, reused near-verbatim in `bulk-form-edit.ts`), badge
  text drawn from four label tables in `indicator-labels.ts`
  (`INDICATOR_LABELS` — the genuinely opaque ✨🍀☾💎-style glyphs/combos —
  plus `RARITY_FILTER_LABELS`/`SPECIES_FILTER_LABELS`/
  `AVAILABILITY_FILTER_LABELS`/`MEGA_ACHIEVEMENT_FILTER_LABELS`, which are
  abbreviations and less opaque). Disambiguation today is `title:
  label.full` — hover-only, useless on touch. `.filter-bar` already wraps
  (`flex-wrap: wrap`), so room isn't structurally blocked; the tighter
  constraint is the desktop anchored filter panel's fixed `320px` width
  (`.filter-sheet` in `style.css`, phone gets a full-width bottom sheet).
  The Help page already has a "Badge glyphs" table covering 10 of 30
  `INDICATOR_LABELS` entries and prose on the tri-state cycle — it does
  NOT cover the other three label tables (L/M/UB/XXL/XXS/P/Mega/D?/G?/
  Mega✓ are all undocumented there). A legend affordance (e.g. a "?" near
  the filter icon or filter-sheet title) generalizing that existing Help
  content to all four tables is the natural shape here, not full text on
  every chip.
- [x] Add a form-name filter box to the species detail page (currently
  unsearchable at high form counts, e.g. Pikachu's 188 forms) —
  `src/features/data-entry/species-detail.ts`. Shows only when a species has
  more than 8 form groups; filtering also auto-expands every matching group.
  Reuses the same focus/cursor-preservation fix as the bulk-edit search box
  below, since it has the identical rerender-destroys-the-input shape.
- [x] Remove `maximum-scale=1.0` to restore pinch-zoom (`src/index.html`).
- [x] Nav drawer accessibility: `inert`/`visibility:hidden` when closed,
  Escape-to-close, focus management on open/close, `aria-expanded` on the
  hamburger (`src/app-shell/nav-drawer.ts`, `src/app-shell/header.ts`,
  `src/main.ts`). The drawer gets `inert` whenever closed (removed on open),
  Escape closes it when open, focus moves to the first nav item on open and
  back to the hamburger on close (only when the drawer was actually open —
  doesn't hijack focus on ordinary route navigation), and the hamburger's
  `aria-expanded` stays in sync both when `renderHeader` runs fresh and when
  `setDrawerOpen` toggles without a header rerender.
- [x] Fix the bulk-edit search-input focus-loss bug — the page rebuilds
  around the input on every keystroke (`src/features/data-entry/bulk-form-edit.ts`
  ~line 96-100). This was a real bug, not polish: typing was effectively
  broken past the first character since focus landed on a since-destroyed
  input. Fixed by capturing cursor position before `rerender()` and
  restoring focus + cursor onto the freshly-created input after.
- [x] In-place select-mode tile toggling (avoid full-grid rebuild per tap) +
  debounce the grid filter input (`src/features/data-entry/species-grid.ts`,
  `src/main.ts`). Tapping a tile in select-mode no longer calls back into a
  full `renderGrid()` — it mutates the shared `selectedSpecies` Set directly
  and updates just that tile's classes/check-mark plus the small bulk-action
  bar (which lives in its own stable DOM slot, replaced in place rather than
  rebuilt inside the grid). The `onToggleSpeciesSelection` callback became
  dead code once this landed and was removed rather than left unused. Grid
  filter input debounced 150ms in `header.ts`. This was the highest-risk
  change in this pass (no browser to visually confirm the interaction feels
  right) — reasoned through carefully rather than eyeballed; flagging for a
  real-device check.
- [x] Nav de-noising: resolved as part of the mobile ergonomics redesign
  (see bottom of this file) — Dex/Bulk Edit/Stats/Settings are the 4 primary
  tab-bar slots, everything else (Search Tools, Coverage Report,
  Achievements, XP Assistant) folds under a "More" entry on phone (the
  sidebar `>=720px` just shows all 8, no room constraint there).
- [x] Stats drill-down: `scrollIntoView` on the missing-species detail panel,
  make species names link to `speciesDetailPath` (`src/features/stats/stats-page.ts`) —
  done as part of the §3 PowerBI-dashboard bullet above (same drill-down
  rework).
- [x] Add an `aria-live="polite"` status region for async states (Computing…,
  Exporting…, Imported…) — added directly to the existing status elements
  (`settings-page.ts`'s `statusEl`, `stats-page.ts`'s `bodyEl`) rather than
  inventing new ones, since both already only ever hold exactly this kind of
  transient text.
- [ ] Species detail: rebuild only the toggled form tile in place instead of
  the whole page per checkbox (`src/features/data-entry/species-detail.ts`).
  Still not done — the accordion this originally referred to is gone (see
  the mobile ergonomics redesign at the bottom of this file, which replaced
  it with a searchable form-tile grid), but every tile/field toggle still
  triggers a full-page `rerender()`. Same deferred risk shape as before,
  just on the new grid instead of the old accordion.
  **Scoping pass (2026-07-13)**: most of the interaction surface is
  genuinely tile-local — form-field cascades (`resolveFormFieldCascade`,
  `src/db/cascades.ts`) never cross tiles, only sections within one form
  record. Comparable in shape to the already-completed in-place select-mode
  work on the Dex grid. The one real complication: any form/Mega toggle can
  flip `speciesPersonal.registered` false→true as a side effect
  (`cascadeSpeciesRegisteredForForm`, `in-memory-store.ts`), and that value
  renders in `speciesFieldset` — a structurally separate DOM region built
  once at the top of the page, outside `formGrid`/`megaFieldset`. In
  practice this only fires on a species' first-ever personal-field write
  (the cascade explicitly no-ops once already registered) and is always
  monotonic (never needs unsetting), but there's currently no signal for
  the caller to know it fired — `setFormPersonalField`/etc. are
  void-returning, and the internal `onXChanged` hooks aren't exposed as a
  UI-reactive subscription — so an in-place patch needs either a
  before/after diff of `repo.getSpeciesWithForms(...).personal.registered`
  around each mutating call, or a small Repository API addition reporting
  which fields a write actually touched. The Registered `<input>` itself
  also has no stable element handle to patch yet (built in a loop over
  `SPECIES_FIELDS` with no id/data-attribute).
- [x] Set `alt=""` on grid tile sprite images (currently duplicate the visible
  name label to screen readers) — `src/features/data-entry/species-grid.ts`.
- [x] **Bulk Edit: selection highlight is completely invisible (owner report,
  2026-07-13)**. `bulk-form-edit.ts` applies a `.selected` class to a tapped
  tile, but **no CSS rule for `.form-tile.selected` exists anywhere in
  `style.css`** — confirmed by grep, only `.form-tile.active-tile`
  (species-detail's unrelated expand state) exists. So tapping a tile to
  select it for bulk-apply has zero visible effect. The only thing that
  IS visible on a tile is an unrelated "✓" badge meaning "this
  species/form already has the target field true" (`alreadySet`,
  independent of tap-selection) — likely what read as "some pokemon show
  as selecting more than one," since several tiles can legitimately show
  that pre-existing ✓ at once. Fixed with one CSS rule (`.form-tile.selected`
  — accent-wash background + accent border, same tinted-selection language as
  `.missing-chip.on`), distinct from the ✓ badge.

---

## Mobile ergonomics redesign (post-§4, owner-directed)

*Not part of the original §3/4 scope above — a follow-on pass the owner asked
for after using the app on a phone and calling it "actively hostile." Pitched
as mockups first (3 directions, then a merged/refined round after feedback),
then built as one combined branch/PR per the owner's explicit call ("one
giant PR instead of 5") rather than the originally-planned 5-PR sequence.*

- **Nav**: bottom tab bar (phone, `<720px`) / persistent left sidebar
  (`>=720px`) replaces the hamburger + overlay drawer at every width. 4
  primary slots (Dex, Bulk Edit, Stats, Settings) plus a "More" tab folding
  in Search Tools/Coverage Report/Achievements/XP Assistant on phone; the
  sidebar shows all 8 with no folding, since there's room. Both driven by
  the existing 720px breakpoint — no resize-listener/layout-mode JS.
  (`src/app-shell/nav-drawer.ts`, `src/main.ts`)
- **New shared primitive**: `src/ui/overlay-panel.ts` — generalizes the
  backdrop + `inert` + focus-management logic that used to live only in
  `main.ts`'s drawer code, so the nav's "More" flyout and the new filter
  sheet below share one implementation.
- **Search + callable filters**: the header's search bar (previously
  replaced by a "Filters" button in an earlier mockup round, which was a
  mistake the owner caught) is back and permanent; a small filter-icon
  button next to it (active-count badge) opens the caught/classification/
  achievement chips as a bottom sheet (`<720px`) or a small anchored panel
  (`>=720px`) instead of always showing them inline.
  (`src/app-shell/header.ts`, `src/features/data-entry/species-grid.ts`)
- **Dex tile quick-toggle**: every grid tile gets one interactive toggle —
  Registered (species-level, unambiguous) — as a sibling `<button>` over the
  tile rather than nested inside its own `<button>` (nesting interactive
  content in a `<button>` is invalid HTML). Shiny/lucky/etc. stay read-only
  badges since they're per-form facts a species tile can't unambiguously
  write back to. (`src/features/data-entry/species-grid.ts`)
- **Species-detail form grid**: the `<details>` accordion (plus its separate
  overview-grid shortcut) is replaced by one searchable grid of form tiles —
  the actual fix for high-form-count species like Pikachu's 188 costumes,
  where search narrows the grid directly. Each tile shows Caught (always) +
  one configurable second achievement icon (new Settings picker: Shiny/
  Lucky/Shadow); tapping a tile expands it in place for its full field list.
  A per-species "Missing only" chip filters to uncaught forms. Search is now
  always shown (previously gated behind an 8-group threshold).
  (`src/features/data-entry/species-detail.ts`)
- **Bulk Edit**: the checkbox-rows-under-a-species-card list becomes the
  same tile grid as species-detail — tap to select/deselect, an "already
  set" checkmark shows the targeted field's current value. Region/caught/
  field-chip filters move behind the same search + filter-icon combo as the
  Dex grid. (`src/features/data-entry/bulk-form-edit.ts`)
- **Explicitly out of scope**: per-form/costume sprite art (still the
  separate, already-scoped §7 image-pipeline task — form tiles use the
  species-level sprite as a placeholder); a swipeable form-carousel (an
  earlier mockup direction the owner said didn't feel right); making
  achievement fields directly tappable from the *Dex* grid (per-form facts,
  no single form for a species tile to write to — they're tappable from the
  *form* grid instead, where one tile is one form).
- **Real risk, not resolved by this pass**: whether tile grids actually hold
  up at full scale (1024+ species, ~8,000+ form rows, Pikachu-scale
  outliers) can't be verified in this environment (no browser) — a handful
  of hand-picked tiles in a mockup always looks fine. This needs an on-device
  check against the real dataset, not just lint/build passing.

## Post-image-pipeline polish (owner feedback, on-device pass, 2026-07-12)

*Real art shipping via §7 exposed layout issues invisible with placeholder
sprites. Deliberately not fixed in the moment — added here to review
together as a batch, not fixed piecemeal.*

- [x] Species-detail header: split into an identity box (sprite/name/nav)
  on the left and a Region + Type(s) box on the right. Shipped in v0.12.1
  (PR #17). (`src/features/data-entry/species-detail.ts`'s
  `.detail-header`, `src/style.css`)
- [x] Form-tile and hero sprites bumped up (34px → 56px, 2.75rem → 4.5rem).
  Shipped in v0.12.1 (PR #17).
- [x] Desktop `#app` width cap removed entirely at the 720px breakpoint.
  Shipped in v0.12.1 (PR #17).

## Search audit (owner report + full audit, 2026-07-13)

*Owner reported no way to search costume/legendary/mythical/ultrabeast from
any search box, plus asked for a broader audit ("probably some other major
search issues I've missed"). Minimal keyword search (`costume`/`legendary`/
`mythical`/`ultrabeast`, `!`-negation) shipped — see PR #20. These are the
remaining findings from that audit, reported but deliberately not fixed
without checking in first:*

- [ ] Dex-number search is unanchored substring matching, not
  prefix/exact — typing `25` to jump to #25 Pikachu also matches #125,
  #225, #250-259, #325, #425, etc. (21 species for a query meant for one).
  Affects the grid, Bulk Edit, and the header's species-detail "jump to"
  box. (`String(species.dexNumber).includes(q)`,
  `src/data/in-memory-store.ts`)
- [ ] Apostrophe/punctuation mismatch: `reference.json` stores Farfetch'd/
  Sirfetch'd with a curly quote (U+2019); typing the ordinary keyboard
  apostrophe never matches. `Mr. Mime`/`Mr. Rime`/`Type: Null` require
  typing the exact period/colon most people wouldn't type. No punctuation
  normalization exists anywhere in the search path.
- [ ] `legendary`/`mythical`/`ultrabeast` keyword search duplicates the
  existing L/M/UB classification chips exactly (same `species.rarity`
  predicate) and composes by AND with them — typing `legendary` while the
  L chip is set to Exclude silently produces zero results with no
  indication why. `costume` is the only keyword with no chip equivalent.
- [ ] Header "jump to species" box (`src/app-shell/header.ts`, species-detail
  route only) isn't debounced (unlike the grid's filter input in the same
  file), has no "no matches" empty state, and no truncation indicator past
  its 8-result cap.
- [x] Doc-drift: this file's §4 claimed the species-detail form filter
  "auto-expands every matching group" — not present in current code
  (`expandedKeysForRender` only mutates on tile click). Stale, left over
  from the pre-mobile-redesign accordion. Noted here, not worth a separate
  fix.
