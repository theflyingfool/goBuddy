*Part of the [V1 Task Breakdown](README.md). Previous: [2. Data-safety net](02-data-safety-net.md). Next: [5–6. Mega & Gigantamax](04-mega-and-gigantamax.md).*
*Roadmap context: [Addendum, point 4](../v1-roadmap/addendum.md).*

## 3. Visual identity pass (new — do this before § 4)

*The owner: "We need a more professional UI from day one." This is real
design work — not pre-decided in this planning pass.*

- [ ] Ensure we have a responsive UI: on a desktop / tablet we should be
  using most of the space not limiting to a "phone"
- [ ] We are correctly defaulting to dark mode, but this should be a toggle
- [ ] The stats page should look like a well done powerBI dashboard or similar
- [ ] Define the visual direction: a considered palette (named hex values,
  not defaults), a type pairing (display + body face), and a spacing/layout
  system. Treat as its own dedicated design session/pass, not a quick pick.
- [ ] Apply the system to the app shell: `src/style.css` design tokens,
  `src/app-shell/header.ts`, `src/app-shell/nav-drawer.ts`.
- [ ] Apply to the species grid: tiles, filter chips, filter bar
  (`src/features/data-entry/species-grid.ts`).
- [ ] Apply to species detail: fieldsets, form groups, overview grid
  (`src/features/data-entry/species-detail.ts`).
- [ ] Apply to the stats page: table, progress bars
  (`src/features/stats/stats-page.ts`).
- [ ] Apply to Settings (`src/features/settings/settings-page.ts`).
- [ ] Dark-mode audit against the new system — `color-scheme: light dark` is
  already set (`src/style.css`); verify it still holds with the new palette,
  then add a manual override toggle (can slip to V1.x if time-constrained).

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
