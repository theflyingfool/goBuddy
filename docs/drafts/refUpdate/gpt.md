

````md
# Pokémon GO Reference Project — Chat Handoff

## Goal

Build a standalone, comprehensive, community-maintainable Pokémon GO reference-data project.

It is NOT being designed around any particular consuming app. The goal is to create a definitive reference/knowledge base that other applications can consume.

Core philosophy:

> Capture as much useful Pokémon GO information as possible. Applications decide later what they need.

Do not discard data merely because nobody currently has a use for it.

## Current Direction

- GitHub is the project home.
- GitHub Pages is the one firm architectural requirement.
- Everything else should be evaluated rather than assumed.
- Data should be extremely well normalized.
- The final storage format is intentionally undecided.
  - Evaluate SQLite, DuckDB, Parquet, JSON/JSONL, combinations, etc.
- A generated "master JSON" may be useful for exploration/distribution, but should not necessarily be the source of truth.
- Source-specific raw data should be preserved and never destructively normalized.
- Each source will likely have its own ingestion area/directory, but exact structure is TBD.
- The project should support independently versioned/reference-data releases.

## Sources

Multiple Pokémon GO data sources are being aggregated because no single source appears complete.

Known principle:
- Game Master is generally highly authoritative for Pokémon GO-specific game configuration.
- No source should be considered universally authoritative.
- Authority should be determined by data domain/field.

Claude is currently scouting the existing project for old/current data sources that should be included.

The current sources will be provided to the project-building AI.

## Provenance

Reference data needs strong provenance.

Track, where available:

- Source
- Original source ID
- Source version
- Retrieval date/time
- Ingestion/build version
- Transformation/normalization information
- Trust/authority

The system should be able to answer:

> Where did this fact come from?

Multiple conflicting claims should be retained rather than silently overwritten.

## Claims / Trust

Distinguish between:

- Raw source information
- Claims
- Canonical facts

Potential trust progression:

```text
Unknown user submission
→ Unverified claim
→ Corroborated
→ Trusted contributor
→ Strong source evidence
→ Canonical
````

Random user submissions should have low trust.

Trusted contributors should have higher trust.

User submissions may introduce entirely new data categories/entities that don't currently exist and could require new tables/schema evolution.

## Community Website

A non-technical contribution system is desired from day one.

GitHub Pages should host a public website/data explorer and potentially the submission experience.

The website should also allow users to explore the normalized/canonical data immediately.

GitHub PRs may remain useful for technical changes, but non-technical users should not need Git/GitHub knowledge to submit information.

## Data Explorer

A data explorer is wanted immediately.

It should eventually allow inspection of:

* Raw/source information
* Normalized data
* Canonical data
* Relationships
* Provenance
* Conflicts
* Versions/history

The purpose is partly to understand what has actually been assembled before finalizing the architecture.

## Architecture

Preferred conceptual pipeline:

```text
Raw Sources
↓
Source-specific ingestion
↓
Normalized representations
↓
Validation
↓
Cross-source comparison
↓
Conflict detection
↓
Canonical reference model
↓
Generated/distributed artifacts
```

The exact implementation should be determined after source inventory.

Do not prematurely force every source into tables.

Canonical identity should be independent of source-specific IDs.

## Historical Data

Where practical, retain historical information.

Pokémon GO changes over time, so the dataset should eventually support questions like:

* When did a value change?
* When was a move changed?
* When did a costume/form appear?
* What did the data say previously?

## Assets

Keep reference data and copyrighted assets conceptually separate.

Asset metadata can reference assets without requiring the canonical database to contain the actual images.

Track source/license/attribution information where known.

## Distribution

The dataset should eventually be consumable through appropriate combinations of:

* Downloadable database
* Static JSON/JSONL
* Version manifests
* API-like static endpoints
* GitHub Releases
* GitHub Pages

Do not assume a conventional backend is necessary.

GitHub Pages is the firm requirement; architecture underneath it is open for evaluation.

## App Relationship

The reference project should be independent of the Pokémon GO companion app.

The app may eventually consume a versioned generated artifact, potentially via Git submodule during development, but the reference project must not be designed around the app's current schema/UI.

The reference dataset should be able to evolve far beyond what the app currently consumes.

## Important Current App Context

The separate app is currently:

* Vue 3
* Tauri
* SQLite
* Drizzle

But those technologies are NOT constraints on the reference project.

The app itself is being separately reviewed/refactored.

## User App Design Context

The companion app's redesign is being handled separately by Claude.

Its process is:

1. Audit inherited codebase.
2. Ask what would be refactored before adding features.
3. Determine whether apparent design problems are actually component architecture/migration problems.
4. Refactor where appropriate.
5. Re-evaluate whether a major UX redesign is still necessary.
6. Review roadmap/features.
7. Have a Pokémon GO expert evaluate the product.
8. Only redesign where justified.

The app's user tables are considered close to good and should be treated as a strong foundation rather than casually replaced.

Reference data is NOT finalized and may move to the new standalone reference project.

## Product Ideas Relevant to Future Architecture

The companion app may eventually support:

* Complex Pokémon GO search/query building
* Collection insights/analytics
* OCR/screenshot recognition
* Local-first collection storage
* Optional device sync
* Peer-to-peer/LAN comparison
* Comparing collections with other users
* Trade assistance
* Potential Google Drive-based sync
* Potential decentralized/peer-to-peer architecture

These are NOT requirements for the reference project.

## Immediate Plan

Do not wait for every architectural question to be solved.

Start the reference project while Claude finishes source archaeology.

Initial useful work:

1. Create GitHub repo.
2. Establish GitHub Pages.
3. Inventory sources.
4. Preserve raw sources.
5. Build basic source metadata/provenance machinery.
6. Build an initial data explorer.
7. Run a normalization spike against a substantial source.
8. Wait for Claude's source inventory and proposed prompt.
9. Combine:

   * this project brief
   * Claude's prompt
   * Gemini/Antigravity's prompt
   * discovered sources
10. Have the three perspectives produce/reconcile the final architecture and implementation plan.

Do NOT prematurely lock the database technology or canonical schema.

The central architectural question is:

> What is the best architecture for building a comprehensive, provenance-aware, versioned, community-maintainable Pokémon GO knowledge base from heterogeneous sources, while using GitHub Pages as its public web/distribution foundation?

```
```
