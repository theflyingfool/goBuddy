*Part of the [V1 Roadmap](README.md). Previous: [Theme 3 — Feature rescoping](03-feature-rescoping.md). Next: [Theme 5 — Legibility & accessibility](05-legibility-accessibility.md).*

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
