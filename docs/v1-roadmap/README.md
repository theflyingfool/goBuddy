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

*This report was originally one file; it's split here by theme so each part
is scannable on its own. Design rationale that's since been **decided**
(rather than just reviewed) has moved to [data-model.md](../data-model.md) —
this report and `docs/v1-tasks/` link back to it rather than re-explaining it.*

## Contents

- Executive summary, "What V1 means," and strengths (this page)
- [Theme 1 — Data safety](01-data-safety.md)
- [Theme 2 — Reference-data corrections](02-reference-data-corrections.md)
- [Theme 3 — Feature rescoping](03-feature-rescoping.md)
- [Theme 4 — Performance & first impressions](04-performance-first-impressions.md)
- [Theme 5 — Legibility & accessibility](05-legibility-accessibility.md)
- [Theme 6 — Desktop story](06-desktop-story.md)
- [Theme 7 — Quality infrastructure](07-quality-infrastructure.md)
- [Theme 8 — Documentation](08-documentation.md)
- [The V1 workplan](workplan.md) (sequenced phases, "Deliberately NOT in V1," V1.x/V2 outlook)
- [Addendum (2026-07-08 owner decisions)](addendum.md)
- [Open questions & coverage map](open-questions.md)

See also: [docs/v1-tasks/](../v1-tasks/) for the executable task breakdown.

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

*Next: [Theme 1 — Data safety](01-data-safety.md).*

