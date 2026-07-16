# PoGo Buddy (CLAUDE.md)

## Project Overview

A local-only Web/Android Pokémon GO companion app that runs fully offline. All personal collection data is saved in a local SQLite database that resides entirely on the device. It provides living-dex progress tracking, completion lens analytics, and fast mobile-optimized checklist interfaces.

Core principles:
- Local-first
- User owns their data
- Simple, maintainable architecture
- Long-term extensibility over short-term hacks

---

## Project Invariants

These should almost never change.

- User data must remain portable.
- Avoid unnecessary external dependencies.
- Do not duplicate sources of truth.
- Major architectural changes should be documented.
- Preserve backwards compatibility where practical.

---

## Working Guidelines

- Read the relevant documentation before making significant changes.
- Prefer modifying existing systems over creating parallel ones.
- Ask for clarification when requirements are ambiguous.
- Keep changes scoped to the requested task.

---

## Documentation Map

Project documentation:
→ README.md

Architecture:
→ docs/architecture.md

Database & Schema:
→ docs/data-model.md

Features & Specs:
→ docs/features.md

Command Reference:
→ docs/commands.md

Engineering / Release Checklist:
→ docs/release-checklist.md

Operational runbooks:
→ docs/ingestion-runbook.md

Trackers & Logs:
→ docs/issues.md
→ docs/costume-lookup-verification.md

Version history:
→ CHANGELOG.md

---

## Before Making Changes

Determine which documentation applies.

Examples:

- Database work
  → docs/data-model.md

- Codebase layout / patterns
  → docs/architecture.md

- Sprites & Ingestion
  → docs/ingestion-runbook.md

- Dev commands / running tests
  → docs/commands.md

- Build/release
  → docs/release-checklist.md

- Installation / sideloading
  → docs/install-guide.md

- Features spec
  → docs/features.md

---

## Documentation Rules

- Every topic has one canonical source.
- Link instead of duplicating information.
- Update documentation when behavior changes.
- Archive obsolete information instead of letting it drift.

---

## When Unsure

Stop and ask.

Do not invent:
- project goals
- future features
- architecture decisions
- Pokémon GO mechanics

If the documentation conflicts, identify the conflict instead of choosing one.
