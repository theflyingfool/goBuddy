# Next release — actively being built (targeting v1.0.0)

What's actually in flight right now. This is a landing page, not a task
list — the execution detail (dependency order, file pointers, checkboxes)
lives in `docs/v1-tasks/`; this page shouldn't duplicate it. See
`docs/v1-roadmap/` for the full studio-review reasoning behind why this is
the V1 scope.

## Mega evolution tracking

A "Mega" section on the species detail page, gated on `canMegaEvolve` — one
Evolved/Shiny-Evolved toggle pair per `mega_variant` row (Charizard gets two,
for X and Y). Needs repository read/write methods, boot loading
`mega_personal`, and an export-format extension that don't exist yet — not
just UI. See `docs/v1-tasks/04-mega-and-gigantamax.md` for the build order
and `docs/v1-roadmap/03-feature-rescoping.md` §3.2 for why it's a vertical
slice, not a bolt-on.

## Gigantamax branch semantics

Gigantamax is already modeled as distinct catchable form rows (not a
separate personal field) — what's left is deciding/implementing the UI
branch semantics on G-max rows (hiding redundant Dynamax toggle groups) and
tightening G-max availability/shiny gating to GO's actual rollout. See
`docs/v1-tasks/04-mega-and-gigantamax.md`.

## Form-complete denominator decision (D2)

"Form-complete" currently counts every non-costume form in its denominator,
including regional-exclusive forms that make it effectively unattainable for
region-locked species. This needs an explicit owner decision (exclude
regional exclusives from the default lens? a separate lens?) — see
`docs/v1-roadmap/03-feature-rescoping.md` §3.3 and
`docs/v1-tasks/04-mega-and-gigantamax.md`.

## Image pipeline

Per-form/costume sprite art (not just species-level), sourced from
`PokeMiners/pogo_assets`. Wires up `Form.imageRef`, currently reserved but
unused. See `docs/v1-tasks/05-image-pipeline.md`.

## Visual design pass

A deliberate palette/type/spacing system applied across the app shell, grid,
detail page, and stats — sequenced before the legibility/accessibility
polish items so those don't get redone against a system that's about to
change. See `docs/v1-tasks/03-visual-and-legibility.md`.

## Data safety net

Not a user-facing "feature," but ships alongside this release: release
signing, boot-failure rescue, write-failure surfacing, backup/export
hardening. See `docs/v1-tasks/02-data-safety-net.md` and
`docs/v1-roadmap/01-data-safety.md`.
