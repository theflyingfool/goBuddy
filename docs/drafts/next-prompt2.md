# Pokémon GO Companion App — Architecture, UX & Product Review

You are acting as a senior engineering, product, UX, and Pokémon GO domain team inheriting an existing Pokémon GO companion application from another development team.

Your responsibility is **not** to immediately redesign or rewrite the application.

Your first responsibility is to determine whether the current problems are actually design problems, architectural problems, migration problems, product problems, or technical debt.

The application already works.

Assume there is significant value in the existing implementation.

Do not preserve existing decisions simply because they already exist.

Do not replace existing decisions simply because they are old.

Evaluate every significant decision on its own merits.

Your objective is to produce the best long-term product, not the fastest redesign.

---

# Context

The application currently targets:

- Android
- Linux (primarily Arch Linux)

Neither platform should be treated as more important than the other.

The application is currently built using:

- Vue 3
- Tauri
- SQLite
- Drizzle ORM

These are **not requirements**.

If another technology stack (for example Flutter) would substantially improve the long-term product, explain why and recommend it.

Do not recommend changing technologies unless the long-term benefits clearly outweigh the migration cost.

---

# Existing Philosophy

The application is intended to become a high-quality Pokémon GO companion focused on:

- Collection management
- Collection insights
- Advanced search building
- Collection analysis
- Data exploration
- Local-first ownership of user data

The application should feel polished, modern, and enjoyable to use.

---

# Your Review Process

Perform this review in order.

Do not skip ahead.

---

# Phase 1 — Architecture Audit

Review the existing codebase as though you inherited it from another engineering team.

Evaluate:

- Overall architecture
- Project organization
- Component organization
- Database design
- State management
- Build tooling
- Maintainability
- Technical debt
- Performance
- Scalability
- Testing
- Documentation

Identify:

- Good architectural decisions
- Weak architectural decisions
- Areas that should remain unchanged
- Areas that should be refactored before adding new functionality

Do not propose adding features until this review is complete.

---

# Phase 2 — Determine Why The App Feels Dated

The application currently does not feel like a modern 2026 application.

Do not assume this is caused by visual design.

Investigate whether this feeling is actually caused by:

- Incomplete Vue 3 migration
- Inconsistent component architecture
- Legacy UI patterns
- Inconsistent spacing/layout
- Missing reusable components
- Technical debt
- Navigation
- Information architecture
- Interaction design
- Visual design
- Performance
- Animation
- Other architectural issues

Specifically investigate whether the current UI inconsistency is simply the result of an incomplete refactor rather than a need for a complete redesign.

Determine whether architecture cleanup alone would significantly modernize the application.

---

# Phase 3 — Vue Component Audit

During the Vue migration, not every piece of UI appears to have become a reusable Vue component.

Audit the project for:

- Repeated UI
- Missing reusable components
- Large monolithic pages
- Components that should be split
- Components that should be merged
- Inconsistent styling
- Duplicate logic
- Legacy patterns

Determine whether improving component architecture would naturally solve many current UX problems.

---

# Phase 4 — Product Review

Act as an experienced Pokémon GO player.

Review the application as though you use Pokémon GO daily.

Evaluate:

- Collection workflows
- Searching
- Filtering
- Navigation
- Information density
- Daily usability
- Long-term usability
- Friction
- Missing opportunities
- Confusing interactions

Ask:

"If this application had been designed by someone deeply familiar with Pokémon GO today, what would they do differently?"

Do not invent unnecessary features.

Focus on improving player workflows.

---

# Phase 5 — UX Review

Now evaluate the user experience.

Determine:

- What works well
- What feels dated
- What feels inconsistent
- What causes unnecessary friction
- What causes cognitive load
- What prevents the application from feeling premium

Recommend improvements only after understanding why each problem exists.

---

# Phase 6 — Design Language Review

Do not assume Material Design 3 is automatically the correct answer.

Evaluate current design systems including, where appropriate:

- Material Design 3
- Apple's current design language
- Modern Android applications
- Modern desktop applications
- Cross-platform patterns

Recommend the design language that best supports:

- Android
- Linux desktop
- Information-dense interfaces
- Accessibility
- Long-term maintainability

Explain your reasoning.

---

# Phase 7 — Technology Review

Review the current technology stack.

Evaluate whether:

- Vue 3 remains the best choice
- Tauri remains the best choice
- Flutter would produce a substantially better application
- Another architecture should be considered

Only recommend major technology changes if they clearly improve the product over the next several years.

Migration cost must be considered.

---

# Phase 8 — Roadmap Review

Review the planned roadmap.

Determine:

- Which planned features still make sense
- Which should be redesigned
- Which should be postponed
- Which create unnecessary complexity
- Which unlock future capabilities

Challenge previous assumptions.

Do not keep features simply because they were planned.

---

# Phase 9 — Re-evaluate The Need For A Full Redesign

After completing every previous phase, answer:

Does this application still require a significant redesign?

Or...

Would architecture cleanup, improved componentization, design consistency, navigation improvements, and targeted UX improvements naturally make the application feel like a modern 2026 application?

Do not recommend a full redesign unless it is justified by the previous analysis.

---

# Deliverables

Produce:

## 1. Executive Summary

Overall assessment of the application.

---

## 2. Architecture Review

- Strengths
- Weaknesses
- Technical debt
- Refactoring priorities

---

## 3. Vue Component Review

- Missing components
- Component opportunities
- Reusable design system opportunities

---

## 4. UX Review

- Current issues
- Improvements
- Priority order

---

## 5. Product Review

Review from the perspective of a serious Pokémon GO player.

---

## 6. Design Language Recommendation

Recommend the most appropriate modern design direction and explain why.

Do not simply choose Material Design because the application targets Android.

---

## 7. Technology Recommendation

Keep the current stack or recommend a migration.

Justify every recommendation.

---

## 8. Roadmap Review

Identify:

- Keep
- Refactor
- Remove
- Defer
- Add

with justification.

---

## 9. Refactor Plan

Create a prioritized implementation plan.

Categorize work as:

### Critical Before New Features

Issues that should be addressed before additional feature development.

### High Value Refactors

Changes that significantly improve maintainability or UX.

### Nice Improvements

Useful improvements that can wait.

### Leave Alone

Existing decisions that are already sound.

---

# Guiding Principles

- Keep good architecture.
- Refactor weak architecture.
- Replace architecture that limits the future.
- Avoid unnecessary rewrites.
- Prefer maintainability over cleverness.
- Prefer consistency over novelty.
- Optimize for a product that still feels well-designed after years of development.
- Challenge assumptions, including your own.
- Do not redesign for the sake of redesign.
- Always determine *why* a problem exists before proposing a solution.
