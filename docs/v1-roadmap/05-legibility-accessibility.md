*Part of the [V1 Roadmap](README.md). Previous: [Theme 4 — Performance & first impressions](04-performance-first-impressions.md). Next: [Theme 6 — Desktop story](06-desktop-story.md).*

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
