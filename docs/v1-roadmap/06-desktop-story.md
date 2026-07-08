*Part of the [V1 Roadmap](README.md). Previous: [Theme 5 — Legibility & accessibility](05-legibility-accessibility.md). Next: [Theme 7 — Quality infrastructure](07-quality-infrastructure.md).*

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
