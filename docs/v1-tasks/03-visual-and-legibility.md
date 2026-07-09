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
  responsive grids, no per-component change needed. **Not done**: the nav
  stays a hamburger-triggered overlay drawer at every width — a permanent
  sidebar on desktop would read more "dashboard-like" but is a real layout
  decision (and one I can't visually verify in this environment), so I left
  it as a candidate follow-up rather than build it blind.
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
- [ ] The stats page should look like a well done powerBI dashboard or
  similar — not yet addressed; the token/type pass below reskins the
  existing table+bar-chart structure in place, but a real dashboard
  treatment (KPI tiles, richer charts) is a further design pass of its own.
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

- [ ] Chip legibility: full labels or a tap-reachable legend for the filter
  chips (currently glyph-only with hover-only tooltips); add `aria-pressed`
  for tri-state chips (`src/features/data-entry/species-grid.ts`,
  `src/features/data-entry/indicator-labels.ts`).
- [ ] Add a form-name filter box to the species detail page (currently
  unsearchable at high form counts, e.g. Pikachu's 188 forms) —
  `src/features/data-entry/species-detail.ts`.
- [ ] Remove `maximum-scale=1.0` to restore pinch-zoom (`src/index.html`).
- [ ] Nav drawer accessibility: `inert`/`visibility:hidden` when closed,
  Escape-to-close, focus management on open/close, `aria-expanded` on the
  hamburger (`src/app-shell/nav-drawer.ts`, `src/app-shell/header.ts`,
  `src/main.ts`).
- [ ] Fix the bulk-edit search-input focus-loss bug — the page rebuilds
  around the input on every keystroke (`src/features/data-entry/bulk-form-edit.ts`
  ~line 96-100).
- [ ] In-place select-mode tile toggling (avoid full-grid rebuild per tap) +
  debounce the grid filter input (`src/features/data-entry/species-grid.ts`,
  `src/main.ts`).
- [ ] Nav de-noising: collapse the stub pages (Search Tools, Achievements, XP
  Assistant) under a muted "Coming later" group; move Coverage Report behind
  Settings or a dev flag (`src/app-shell/nav-drawer.ts`).
- [ ] Stats drill-down: `scrollIntoView` on the missing-species detail panel,
  make species names link to `speciesDetailPath` (`src/features/stats/stats-page.ts`).
- [ ] Add an `aria-live="polite"` status region for async states (Computing…,
  Exporting…, Imported…).
- [ ] Species detail: rebuild only the toggled form group in place instead of
  the whole page per checkbox (`src/features/data-entry/species-detail.ts`).
- [ ] Set `alt=""` on grid tile sprite images (currently duplicate the visible
  name label to screen readers) — `src/features/data-entry/species-grid.ts`.
