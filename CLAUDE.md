# PoGo Buddy (CLAUDE.md)

## Project Overview

A local-only Web/Android Pokémon GO companion app that runs fully offline. All personal collection data is saved in a local SQLite database that resides entirely on the device. It provides living-dex progress tracking, completion lens analytics, and fast mobile-optimized checklist interfaces.

Core principles:

- Local-first
- User owns their data
- Simple, maintainable architecture
- Long-term extensibility over short-term hacks

Operating priority: minimizing token usage is the top-priority constraint on how work gets done in this repo. The Working Guidelines below exist in service of that.

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
- Do not show diffs unless requested; they are often overwhelming and distracting.
- When executing a multi-task implementation plan (`docs/superpowers/plans/*.md`), leave a resumable trail: check off each step's `- [ ]` box in the plan file itself as it's completed (not just tracked mentally), and commit that alongside the task's code so a fresh session/agent can tell exactly what's done from `git log` + the plan file's checkbox state alone, with no other context. Never batch multiple tasks' checkbox updates into one commit.
- Prefer targeted edits over full-file rewrites when modifying existing files.
- Don't narrate routine actions (file reads, searches, standard edits, routine command runs, progress updates). Only surface non-routine findings, decisions, or blockers.
- In background/job sessions, keep narration to near-zero. In interactive sessions, ask clarifying questions rather than guess on ambiguous requirements.
- Prefer bulleted lists over prose in responses where it fits.
- Plans/specs (`docs/superpowers/plans/*.md`, specs) are authored and committed on `master`; execution happens in an isolated worktree/branch.
- Any task touching 5+ files must leave a handoff/log file under `docs/todo/` recording assumptions, so another agent/session can pick it up (matches the existing pattern, e.g. `docs/todo/gorefs-ingestion-swap-pre-merge-testing.md`).

### Development Phase: Rapid / Pre-Release

This project is still in rapid development. Optimize for iteration speed, not
polish:

- Don't add or expand test coverage unless asked — no reflexive tests for every
  change.
- It's fine to commit code that's incomplete or known-broken; this is not yet
  a stability-guaranteed codebase.
- Don't block progress on hardening, edge-case handling, or comprehensive
  verification unless the task specifically calls for it.
- This posture applies until the user signals a shift toward stabilization
  (e.g. approaching a real release, or saying so explicitly).

---

## Documentation Map

Project documentation:
→ README.md

Architecture:
→ docs/architecture.md

Vue migration (in progress):
→ docs/vue-migration-plan.md

Database & Schema:
→ docs/data-model.md

Features & Specs:
→ docs/features.md

Future Roadmap:
→ docs/roadmap.md

Command Reference:
→ docs/commands.md

Engineering / Release Checklist:
→ docs/release-checklist.md

Operational runbooks:
→ docs/ingestion-runbook.md

Trackers & Logs:
→ docs/issues.md
→ docs/costume-lookup-verification.md

Decision rationale:
→ docs/decisions.md

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
