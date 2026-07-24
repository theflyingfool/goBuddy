# Sub-project 3: Vue Migration Completion + Visual Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every remaining vanilla-TS page with real functionality (Coverage Report, Help, Species detail, Dex grid + Bulk Edit) to Vue SFCs, and close three visual-fidelity gaps against the approved mockup (Stats lens-progress list, Trainer medals grid, Log-a-catch FAB).

**Architecture:** Same incremental, route-by-route pattern every prior Vue migration task used — `mountVueRoute(container, Component, props)` from `src/app-shell/mount-vue.ts` swaps in for a route's old vanilla render call in `src/main.ts`; the old vanilla file is deleted once its Vue replacement is verified equivalent. No change to `router.ts`, the `Repository` interface, or app-shell chrome (`header.ts`, `nav-drawer.ts`, the filter-sheet overlay) — those stay vanilla and untouched, exactly as `docs/vue-migration-plan.md` already established for prior migrations.

**Tech Stack:** Vue 3 (`<script setup lang="ts">` SFCs), existing `Repository` interface, Playwright for e2e, `node:test` for unit tests where applicable.

## Global Constraints

- Every personal-table timestamp is epoch-ms (`number`), not an ISO string — already the case throughout the codebase; no timestamp-format work in this plan.
- Search Tools, Achievements, and XP Assistant stay **out of scope** — they are unbuilt stub pages (`src/features/stubs.ts`), not migration debt. Do not build them.
- The Dex grid's filter-sheet overlay (`renderFilterSheetContent`, rendered into `filterSheetEl` outside the main content area) and the app header (`renderHeader`) stay vanilla TS, called by `main.ts` exactly as today — they are shared app-shell chrome, not part of the Dex grid page itself (same category as `header.ts`/`nav-drawer.ts`, which `vue-migration-plan.md` already established as staying untouched).
- Every migrated page's vanilla predecessor file is **deleted**, not kept as a wrapped/legacy call — matching `vue-migration-plan.md`'s established rule ("get deleted, not deprecated-and-kept"), except where a task explicitly says otherwise.
- `docs/vue-migration-plan.md`'s Status section must be updated to reflect each newly-completed migration as its task lands.
- Lint (`npm run lint`, runs automatically via the pre-commit hook) and `npx tsc -b --noEmit` must pass before every commit.

---

## File Structure

| File | Responsibility |
| :--- | :--- |
| `src/features/help/HelpPage.vue` (new) | Static help content, replaces `help-page.ts` |
| `src/features/coverage-report/CoverageReportPage.vue` (new) | Reference-data gap report + CSV export, replaces `coverage-report-page.ts` |
| `src/style.css` (modified) | Adds `.fab` styling (ported from the mockup), `.medal-tile`/`.medal-grid` |
| `src/features/data-entry/SpeciesDetailPage.vue` (new, built across 2 tasks) | Species detail: Tracking tab (achievements, specimens, FAB) + Info tab (matchups, CP calc), replaces `species-detail.ts` |
| `src/features/data-entry/DexGridPage.vue` (new, built across 2 tasks) | Dex grid: tiles/region-grouping/filters, then select-mode/bulk-apply/granularity + Dex-grid FAB, replaces `species-grid.ts` |
| `src/features/data-entry/BulkFormEditPanel.vue` (new) | Form-granularity bulk-edit panel, replaces `bulk-form-edit.ts`, used as a child component inside `DexGridPage.vue` |
| `src/features/stats/StatsPage.vue` (modified) | Adds the lens-progress list card |
| `src/features/trainer/TrainerPage.vue` (modified) | Medals list → grid |
| `src/main.ts` (modified across most tasks) | Swaps each migrated route's render call for `mountVueRoute` |
| `docs/vue-migration-plan.md` (modified across most tasks) | Status section updates |

---

### Task 1: Help page → Vue SFC

**Files:**
- Create: `src/features/help/HelpPage.vue`
- Delete: `src/features/help/help-page.ts`
- Modify: `src/main.ts` (help route)

**Interfaces:**
- Consumes: nothing from `Repository` — pure static content.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Read the source file**

Read `src/features/help/help-page.ts` in full (87 lines) — it is the complete, authoritative behavior spec for this task. It renders five `<fieldset>` sections (Badge glyphs, Stats lenses, Floor/Shundo glossary, Filter chips, Search box keywords) built from a static `REPRESENTATIVE_BADGES` array and `INDICATOR_LABELS` (from `src/features/data-entry/indicator-labels.ts`).

- [ ] **Step 2: Write `HelpPage.vue`**

Port every fieldset's content verbatim (same headings, same paragraph text, same badge rows) into Vue template syntax. Use `v-for="{ field, description } in REPRESENTATIVE_BADGES"` for the badge-glyphs list instead of the vanilla file's manual loop. No `<script setup>` state is needed beyond importing `INDICATOR_LABELS` and the `REPRESENTATIVE_BADGES` array (move that array and its `FormPersonalBooleanField` import into this file's `<script setup>` block, or keep it in a small shared constants file if you prefer — either is fine, just don't duplicate `INDICATOR_LABELS` itself).

- [ ] **Step 3: Wire the route**

In `src/main.ts`, find:
```ts
        case "help":
          renderHelpPage(contentEl);
          break;
```
Replace with:
```ts
        case "help":
          mountVueRoute(contentEl, HelpPage, {});
          break;
```
Remove the `import { renderHelpPage } from "./features/help/help-page";` import and add `import HelpPage from "./features/help/HelpPage.vue";`.

- [ ] **Step 4: Delete the vanilla file**

Delete `src/features/help/help-page.ts`.

- [ ] **Step 5: Verify**

Run `npx tsc -b --noEmit` (clean) and `npm test` (all existing tests still pass — this page has no dedicated unit tests, so this is a regression check on the rest of the suite). Start the dev server (`npm run dev`) and manually confirm `/#/help` renders identically to before (same five fieldsets, same text) using a Playwright script or by eye in a browser — no dedicated e2e test is required for this low-risk, static-content page.

- [ ] **Step 6: Update the migration-plan doc**

Add a line to `docs/vue-migration-plan.md`'s Status section: `- [x] Help (src/features/help/HelpPage.vue) — static content, direct port.`

- [ ] **Step 7: Commit**

```bash
git add src/features/help/HelpPage.vue src/main.ts docs/vue-migration-plan.md
git commit -m "Migrate Help page to a Vue SFC"
```
(`help-page.ts`'s deletion is already staged by `git add -u` behavior of your git client, or add it explicitly: `git add src/features/help/help-page.ts`.)

---

### Task 2: Coverage Report → Vue SFC

**Files:**
- Create: `src/features/coverage-report/CoverageReportPage.vue`
- Delete: `src/features/coverage-report/coverage-report-page.ts`
- Modify: `src/main.ts` (coverage-report route)

**Interfaces:**
- Consumes: `formToCsvRow`/`referenceRowsToCsv` from `src/data/reference-csv-format.ts`, `downloadTextFile` from `src/shared/file-download.ts`, static imports of `src/data/reference-gaps.json` and `src/data/reference.json`. None of these change.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Read the source file**

Read `src/features/coverage-report/coverage-report-page.ts` in full (134 lines) — the complete, authoritative behavior spec. Key logic to preserve exactly:
- `KIND_LABELS` maps each `ReferenceGap["kind"]` to a display label.
- `SUMMARIZE_ONLY` (`["inherited-availability"]`) renders a single summary sentence instead of a per-row list for that one gap kind.
- `formsForGaps()` resolves which forms a CSV export should include for a given gap kind's row list (species-level gaps expand to every form of that species).
- Each fieldset has an "Export as CSV" button with an inline status message (`"Exporting…"` → success count + follow-up command, or a failure message) — this is real async state per-fieldset, not a page-level status.
- The empty state (`gaps.length === 0`) shows one message and renders nothing else.

- [ ] **Step 2: Write `CoverageReportPage.vue`**

Port the grouping/rendering logic into `<script setup>` (computed grouping by kind, same `KIND_LABELS`/`SUMMARIZE_ONLY` constants) and the template (one `<fieldset>` per non-empty gap kind, in `KIND_LABELS`'s declared order). For the per-fieldset export status, use a `ref<Record<string, string>>` keyed by gap kind (or a `ref<string>` per fieldset via `v-for` with a local reactive map) — each button's click handler is `async`, sets the status ref, calls the same `formsForGaps`/`formToCsvRow`/`referenceRowsToCsv`/`downloadTextFile` sequence, and catches errors into the same status ref exactly as the vanilla version does.

- [ ] **Step 3: Wire the route**

In `src/main.ts`, replace:
```ts
        case "coverage-report":
          renderCoverageReportPage(contentEl);
          break;
```
with:
```ts
        case "coverage-report":
          mountVueRoute(contentEl, CoverageReportPage, {});
          break;
```
Update the import accordingly.

- [ ] **Step 4: Delete the vanilla file**

Delete `src/features/coverage-report/coverage-report-page.ts`.

- [ ] **Step 5: Verify**

`npx tsc -b --noEmit` and `npm test` clean. Manually verify in a browser: `/#/coverage-report` shows the same fieldsets as before, and clicking "Export as CSV" on at least one fieldset downloads a file and shows the same success message format.

- [ ] **Step 6: Update the migration-plan doc**

Add: `- [x] Coverage Report (src/features/coverage-report/CoverageReportPage.vue) — direct port, same per-fieldset CSV export behavior.`

- [ ] **Step 7: Commit**

```bash
git add src/features/coverage-report/CoverageReportPage.vue src/features/coverage-report/coverage-report-page.ts src/main.ts docs/vue-migration-plan.md
git commit -m "Migrate Coverage Report page to a Vue SFC"
```

---

### Task 3: Shared FAB styling

**Files:**
- Modify: `src/style.css`

**Interfaces:**
- Produces: a `.fab` CSS class that Tasks 5 and 7 both use for the Log-a-catch floating action button. No JS/TS interface — this is CSS-only.

- [ ] **Step 1: Add `.fab` styling**

Add to `src/style.css` (near the other shared component classes, e.g. next to `.btn`/`.btn-primary`):

```css
.fab {
  position: sticky;
  bottom: 96px;
  margin-left: auto;
  margin-right: 16px;
  width: fit-content;
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: var(--radius-pill);
  padding: 12px 18px 12px 15px;
  font-weight: 700;
  font-size: 0.88rem;
  box-shadow: var(--shadow-pop);
  cursor: pointer;
}
```

Check that `--radius-pill` and `--shadow-pop` (or equivalent existing tokens) are already defined in `src/style.css`'s `:root` block from the earlier "visual pass to match the approved mockup" work (per `vue-migration-plan.md`'s Status section) — if the exact token names differ, use whatever this codebase's equivalent pill-radius/pop-shadow tokens are named instead of introducing new ones. If no desktop-breakpoint override exists yet for other sticky/fixed elements, don't add one here either — match whatever the surrounding CSS already does for position on wider viewports.

- [ ] **Step 2: Verify**

`npx tsc -b --noEmit` is unaffected (CSS-only change). No functional test needed yet — Tasks 5 and 7 will exercise this class visually.

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "Add shared .fab styling for the Log-a-catch floating action button"
```

---

### Task 4: Species detail — Tracking tab (characterization test first)

**Files:**
- Create: `src/features/data-entry/SpeciesDetailPage.vue` (Tracking tab only this task; Info tab added in Task 5)
- Create: `e2e/species-detail-tracking.spec.ts`
- Modify: `src/main.ts` (species-detail route) — **do not delete `species-detail.ts` yet**, Task 5 needs it for the Info tab.

**Interfaces:**
- Consumes: `Repository` methods already used by `species-detail.ts` (do not add new ones) — read the source file for the exact list.
- Produces: `SpeciesDetailPage.vue` exposing the same route contract main.ts already uses: mounted with `{ repo, speciesSlug, onBack }` props, where `onBack` is called to navigate back to the grid (matches the vanilla version's 4th callback argument).

- [ ] **Step 1: Write a characterization e2e test against the CURRENT vanilla code**

This is **not** a normal red-green-refactor test — `species-detail.ts` already works today, so this test must be written to **pass against the current vanilla implementation first**, then must still pass after the Vue rewrite. It is your regression safety net, not a new-feature test.

Read `src/features/data-entry/species-detail.ts` in full (461 lines) before writing this test, to know exactly which behaviors are real. Create `e2e/species-detail-tracking.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("species detail Tracking tab: toggle cascades and specimens list survive a reload", async ({ page }) => {
  await page.goto("/#/data-entry/species/charizard");
  await page.waitForLoadState("networkidle");

  // Toggling a high-tier achievement cascades its prerequisites (e.g. 4-star
  // implies caught) -- adjust the exact toggle labels/selectors below to
  // match whatever species-detail.ts actually renders once you've read it;
  // this is a placeholder shape for the assertion, not literal selector text
  // to copy verbatim.
  const fourStarToggle = page.getByRole("button", { name: /4.?star/i }).first();
  await fourStarToggle.click();
  await expect(page.getByRole("button", { name: /caught/i }).first()).toHaveAttribute("aria-pressed", "true");

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /4.?star/i }).first()).toHaveAttribute("aria-pressed", "true");
});
```

Run it (`npx playwright test e2e/species-detail-tracking.spec.ts`) against the **current, unmodified** vanilla `species-detail.ts` and fix selectors/assertions until it passes green. Do not proceed to Step 2 until this test is genuinely green against the vanilla code — a test you can't get passing against known-working code is testing the wrong thing, not proof the app is broken.

- [ ] **Step 2: Write `SpeciesDetailPage.vue`'s Tracking tab**

Port the Tracking-tab behaviors from `species-detail.ts` into `<script setup>` + template: the achievement toggle groups (Standard/Lucky/Shadow/Dynamax sections, using `resolveFormFieldCascade` from `src/db/cascades.ts` exactly as the vanilla version does for cascade behavior — do not reimplement cascade logic, import and call the same function), the specimens strip (cards showing nickname/CP/IV/tags for `pokemon_instance` rows of this species), and a segmented Tracking/Info control (Info tab body can be a placeholder `<div>` for now — Task 5 fills it in).

- [ ] **Step 3: Add the Log-a-catch FAB**

Add a `<button class="fab">+ Log a catch</button>` inside the Tracking tab (matches the mockup's placement) that navigates to `/#/log-catch?species=<speciesSlug>` (or whatever query/route-param shape `LogCatchPage.vue` already expects for pre-filling a species — check `src/features/log-catch/LogCatchPage.vue`'s existing route-param handling before inventing a new one; if it doesn't yet support being pre-filled, add that support to `LogCatchPage.vue` as part of this step, reading its current species-picker code first to add pre-fill without breaking the unfilled case).

- [ ] **Step 4: Wire the route**

In `src/main.ts`, replace the `renderSpeciesDetail(contentEl, repo, route.speciesSlug, () => { location.hash = "/data-entry"; })` call with `mountVueRoute(contentEl, SpeciesDetailPage, { repo, speciesSlug: route.speciesSlug, onBack: () => { location.hash = "/data-entry"; } })`.

- [ ] **Step 5: Run the characterization test against the Vue version**

`npx playwright test e2e/species-detail-tracking.spec.ts` — must still pass, unchanged, against the new Vue component. If it fails, the rewrite introduced a regression; fix the component, not the test (unless the test itself was wrong, in which case fix the test and re-verify it against the vanilla code first, per Step 1's rule).

- [ ] **Step 6: Verify**

`npx tsc -b --noEmit`, `npm test`, full Playwright suite (`npx playwright test`) all clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/data-entry/SpeciesDetailPage.vue src/main.ts e2e/species-detail-tracking.spec.ts src/features/log-catch/LogCatchPage.vue
git commit -m "Migrate species detail Tracking tab to Vue, add Log-a-catch FAB"
```

(Do not delete `species-detail.ts` — Task 5 still needs it as the Info tab's source.)

---

### Task 5: Species detail — Info tab, delete vanilla file

**Files:**
- Modify: `src/features/data-entry/SpeciesDetailPage.vue` (add Info tab body)
- Delete: `src/features/data-entry/species-detail.ts`

**Interfaces:**
- Consumes: whatever `Repository`/reference-data reads `species-detail.ts`'s Info tab uses (type matchups, CP calculator inputs) — read the source for the exact list.

- [ ] **Step 1: Read the Info tab's current implementation**

Re-read `src/features/data-entry/species-detail.ts`, focusing specifically on the Info-tab rendering path this time (segmented-control branch that isn't Tracking). Per `vue-migration-plan.md`'s Status section, this shows real type matchups and an honest "not available yet" message for base-stat-dependent features (CP calculator, flavor text) — confirm that honest-unavailable messaging is still accurate (base stats/flavor text still aren't in `reference.json` as of this task) and preserve it rather than fabricating numbers.

- [ ] **Step 2: Port the Info tab into `SpeciesDetailPage.vue`**

Replace the Task 4 placeholder `<div>` with the real Info-tab template: type-matchup chips and the "not available yet" messaging, matching the vanilla version's exact wording and conditions.

- [ ] **Step 3: Delete the vanilla file**

Delete `src/features/data-entry/species-detail.ts`.

- [ ] **Step 4: Verify**

`npx tsc -b --noEmit`, `npm test`, `npx playwright test` (including `e2e/species-detail-tracking.spec.ts` from Task 4) all clean. Manually check `/#/data-entry/species/<any-slug>`'s Info tab renders the same content as the vanilla version did (compare against a `git show HEAD~1:src/features/data-entry/species-detail.ts` reference if useful).

- [ ] **Step 5: Update the migration-plan doc**

Add: `- [x] Species detail (src/features/data-entry/SpeciesDetailPage.vue) — Tracking + Info tabs, full Vue rewrite (supersedes the earlier "additive, not a Vue rewrite" note).`

- [ ] **Step 6: Commit**

```bash
git add src/features/data-entry/SpeciesDetailPage.vue src/features/data-entry/species-detail.ts docs/vue-migration-plan.md
git commit -m "Migrate species detail Info tab to Vue, delete vanilla species-detail.ts"
```

---

### Task 6: Dex grid — core render (characterization test first)

**Files:**
- Create: `src/features/data-entry/DexGridPage.vue` (grid rendering + basic filters this task; select-mode/bulk-apply/granularity in Task 7)
- Create: `e2e/dex-grid-core.spec.ts`
- Modify: `src/main.ts` (data-entry-grid route, `renderGrid` closure only — header/filter-sheet wiring is untouched, see Global Constraints)

**Interfaces:**
- Consumes: `GridState`/`GridCallbacks` types, exported today from `species-grid.ts` — **keep these types and their ownership in `main.ts` exactly as they are today**; `DexGridPage.vue` accepts `{ repo, state, callbacks }` as props, mirroring the vanilla `renderSpeciesGrid(contentEl, repo, gridState, gridCallbacks)` call signature. Do not move `GridState`/`GridCallbacks` into the Vue file or change their shape — `main.ts`'s header/filter-sheet code (Global Constraints: stays vanilla, untouched) reads/writes the same `gridState` object.
- Produces: nothing new — this task's job is behavior parity, not a new interface.

- [ ] **Step 1: Read the source file**

Read `src/features/data-entry/species-grid.ts` in full (356 lines) before writing anything. Note specifically: how it groups species tiles by region (with collapse/expand), how `GridState`'s `filterText`/`caughtFilter`/`fieldFilters` narrow the visible set, and the exact tile markup/classes (`.species-tile`, sprite rendering, dex-number/name labels, state-dot indicators) — these CSS classes are shared with other tile-based UI (e.g. `.tag-tile` equivalents) and must not be renamed.

- [ ] **Step 2: Write a characterization e2e test against the CURRENT vanilla code**

Same rule as Task 4 Step 1: write this to pass against **today's** vanilla `species-grid.ts` first.

```ts
import { test, expect } from "@playwright/test";

test("dex grid: search filters the tile list and survives a reload", async ({ page }) => {
  await page.goto("/#/data-entry");
  await page.waitForLoadState("networkidle");

  const initialCount = await page.locator(".species-tile").count();
  expect(initialCount).toBeGreaterThan(0);

  // Adjust the actual search input selector once you've read species-grid.ts
  // and header.ts's "filter" header kind -- this is a placeholder shape.
  await page.getByRole("searchbox").fill("charizard");
  await page.waitForTimeout(300);
  const filteredCount = await page.locator(".species-tile").count();
  expect(filteredCount).toBeLessThan(initialCount);
  expect(filteredCount).toBeGreaterThan(0);
});
```

Get this genuinely green against the vanilla code before proceeding.

- [ ] **Step 3: Write `DexGridPage.vue`'s core render**

Port tile rendering, region grouping/collapsing, and the search/caught/field-filter narrowing logic into `<script setup>` (computed filtered/grouped list from `props.state` + `props.repo`) and template (tiles + region headers). Do **not** port select-mode, bulk-apply, or the granularity toggle yet — Task 7 does that. For now, tiles just navigate via `props.callbacks.onSelectSpecies(slug)` on click, matching today's non-select-mode behavior exactly.

- [ ] **Step 4: Wire the route**

In `src/main.ts`'s `data-entry-grid` branch, replace the `renderGrid` closure's `renderSpeciesGrid(contentEl, repo, gridState, gridCallbacks)` call with `mountVueRoute(contentEl, DexGridPage, { repo, state: gridState, callbacks: gridCallbacks })`. Everything else in that branch (the `gridCallbacks` object definition, `renderHeader`, `renderFilterSheetContent`, `updateFilterBadge`) stays exactly as-is — this is a one-line swap inside `renderGrid`, not a restructuring of the surrounding route-handling code.

- [ ] **Step 5: Run the characterization test against the Vue version**

`npx playwright test e2e/dex-grid-core.spec.ts` — must still pass.

- [ ] **Step 6: Verify**

`npx tsc -b --noEmit`, `npm test`, full Playwright suite clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/data-entry/DexGridPage.vue src/main.ts e2e/dex-grid-core.spec.ts
git commit -m "Migrate Dex grid core rendering to Vue (select-mode/bulk-apply still vanilla)"
```

(Do not delete `species-grid.ts` yet — `main.ts` still imports `GridState`/`GridCallbacks`/`countActiveFilters`/`renderFilterSheetContent` from it, and Task 7 still needs the file's select-mode/bulk-apply code as reference. Task 7 Step 1 relocates those shared exports to `grid-types.ts` before the file is deleted in Task 7 Step 7.)

---

### Task 7: Dex grid — select-mode, bulk-apply, granularity, Dex-grid FAB; delete vanilla files

**Files:**
- Modify: `src/features/data-entry/DexGridPage.vue` (add select-mode/bulk-apply/granularity/FAB)
- Create: `src/features/data-entry/BulkFormEditPanel.vue`
- Delete: `src/features/data-entry/species-grid.ts`, `src/features/data-entry/bulk-form-edit.ts`
- Create/Modify: `src/features/data-entry/grid-types.ts` (new — relocates `GridState`/`GridCallbacks`/`GridFilterField` types and `countActiveFilters`/`renderFilterSheetContent` out of the file being deleted)
- Modify: `src/main.ts` (import paths only — the `data-entry-grid` branch's logic is otherwise unchanged from Task 6)

**Interfaces:**
- Consumes: `GridState`/`GridCallbacks` (now from `grid-types.ts` instead of `species-grid.ts`).
- Produces: `BulkFormEditPanel.vue` accepting `{ repo }` — same call contract as today's `renderBulkFormEditPage(formEditSlot, repo)` — used as a child component inside `DexGridPage.vue`'s template when `state.bulkGranularity === "form"`, not a separately-mounted app.

- [ ] **Step 1: Relocate shared types out of `species-grid.ts`**

Before deleting `species-grid.ts`, its exported `GridState`, `GridCallbacks`, `GridFilterField` types plus the `countActiveFilters` and `renderFilterSheetContent` functions (both still needed by `main.ts` for the vanilla filter-sheet overlay, per Global Constraints) must move to a new `src/features/data-entry/grid-types.ts`. Read `species-grid.ts` in full to find every one of these exports precisely, move them verbatim (no behavior change), and update `main.ts`'s imports to pull from `grid-types.ts` instead.

- [ ] **Step 2: Read `bulk-form-edit.ts` and the rest of `species-grid.ts`**

Read `src/features/data-entry/bulk-form-edit.ts` in full (404 lines) and the select-mode/bulk-apply/granularity-toggle sections of `species-grid.ts` you haven't yet ported in Task 6. Note: `bulk-form-edit.ts` has its own independent filter/search/apply state, entirely separate from `GridState` — it is a self-contained mini-page, not something that reads `gridState`.

- [ ] **Step 3: Write a characterization e2e test against the CURRENT vanilla code**

```ts
import { test, expect } from "@playwright/test";

test("dex grid: select mode, species-field bulk apply, and the form-granularity toggle work", async ({ page }) => {
  await page.goto("/#/data-entry");
  await page.waitForLoadState("networkidle");

  // Adjust selectors once you've read species-grid.ts's select-mode markup.
  await page.getByRole("button", { name: /select/i }).click();
  await page.locator(".species-tile").first().click();
  await page.getByRole("button", { name: /apply/i }).click();
  // Assert the applied field actually changed for that species -- e.g. via
  // navigating to that species' detail page and checking the toggle state,
  // once you know which species/field the test picked.

  // Granularity toggle: switching to "Form fields" hands the content area
  // to the bulk-form-edit panel.
  await page.getByRole("button", { name: /select/i }).click(); // re-enter select mode if it was exited
  await page.getByRole("button", { name: /form fields/i }).click();
  await expect(page.locator(".bulk-form-edit, [data-testid='bulk-form-edit']").first()).toBeVisible();
});
```

Get this green against the vanilla code before proceeding.

- [ ] **Step 4: Write `BulkFormEditPanel.vue`**

Port `bulk-form-edit.ts`'s complete behavior (its own filter/search state, form-field checklist, bulk-apply button) into a real Vue SFC accepting `{ repo }` as its only prop, matching `renderBulkFormEditPage(formEditSlot, repo)`'s existing contract.

- [ ] **Step 5: Finish `DexGridPage.vue`**

Add select-mode toggle, species/form granularity toggle, the bulk-field/bulk-value pickers, and the "Apply" button, wired to `props.callbacks` exactly as `species-grid.ts` does today (`onToggleSelectMode`, `onGranularityChange`, `onBulkFieldChange`, `onBulkValueChange`, `onApplyBulk`, `onClearSelection` — do not rename these callback keys, `main.ts`'s `gridCallbacks` object already defines them). When `state.bulkGranularity === "form"`, render `<BulkFormEditPanel :repo="repo" />` directly in the template instead of a manual DOM-slot mount.

- [ ] **Step 6: Add the Dex-grid FAB**

Add a `<button class="fab">+ Log a catch</button>` (same `.fab` class from Task 3) that navigates to `/#/log-catch` with no species pre-filled — confirm `LogCatchPage.vue` still lands on its normal species-picker step when no species param is present (it should, per Task 4's pre-fill addition being additive).

- [ ] **Step 7: Delete vanilla files, update `main.ts` imports**

Delete `species-grid.ts` and `bulk-form-edit.ts`. Update `main.ts` to import `GridState`/`GridCallbacks`/`countActiveFilters`/`renderFilterSheetContent` from `grid-types.ts`, and `DexGridPage` from the new Vue file.

- [ ] **Step 8: Run the characterization tests**

Both `e2e/dex-grid-core.spec.ts` (Task 6) and this task's new spec must pass against the finished `DexGridPage.vue`.

- [ ] **Step 9: Verify**

`npx tsc -b --noEmit`, `npm test`, full Playwright suite clean.

- [ ] **Step 10: Update the migration-plan doc**

Add: `- [x] Dex grid + Bulk Edit (src/features/data-entry/DexGridPage.vue, BulkFormEditPanel.vue) — full Vue rewrite, species-grid.ts and bulk-form-edit.ts deleted.`

- [ ] **Step 11: Commit**

```bash
git add src/features/data-entry/ src/main.ts docs/vue-migration-plan.md e2e/
git commit -m "Migrate Dex grid select-mode/bulk-apply and Bulk Form Edit to Vue, delete vanilla files"
```

---

### Task 8: Stats page — lens-progress list

**Files:**
- Modify: `src/features/stats/StatsPage.vue`

**Interfaces:**
- Consumes: `Repository.getCompletionStats(scope, lenses)` (`src/data/repository.ts:254`, already exists, already used by `stats-page.ts`'s collapsed table).

- [ ] **Step 1: Write the failing/missing piece**

Add to `StatsPage.vue`'s `<script setup>`:

```ts
const LENS_LIST: { lens: CompletionLens; label: string }[] = [
  { lens: { kind: "registered" }, label: "Registered" },
  { lens: { kind: "formComplete" }, label: "Form-complete" },
  { lens: { kind: "costumeComplete" }, label: "Costume-complete" },
  { lens: { kind: "gigantamaxComplete" }, label: "Gigantamax-complete" },
  { lens: { kind: "megaComplete" }, label: "Mega-complete" },
];
const lensResults = ref<{ label: string; complete: number; total: number }[]>([]);
onMounted(async () => {
  const results = await props.repo.getCompletionStats(
    { kind: "global" },
    LENS_LIST.map((l) => l.lens),
  );
  lensResults.value = results.map((r, i) => ({ label: LENS_LIST[i].label, complete: r.complete, total: r.total }));
});
```

Add `CompletionLens` to the existing `import type { PlayerProgressLogEntry } from "../../db/types";` line's sibling import from `../../data/repository` (it already imports `Repository` from there).

- [ ] **Step 2: Add the template card**

Add a new `chart-card` between the existing `stats-kpi-row` and the XP card:

```html
<div class="chart-card" v-if="lensResults.length">
  <div class="ctitle">Completion by lens</div>
  <div class="hbar-row" v-for="entry in lensResults" :key="entry.label">
    <span>{{ entry.label }}</span>
    <div class="bar-track"><div class="bar-fill" :style="{ width: (entry.total ? (entry.complete / entry.total) * 100 : 0) + '%' }"></div></div>
    <span class="hbar-val">{{ entry.complete }} / {{ entry.total }}</span>
  </div>
</div>
```

Check the existing `.hbar-row`/`.bar-track`/`.bar-fill` CSS grid-column definitions in `src/style.css` render sensibly for this content (label / bar / fraction) — adjust markup to match whatever column structure those classes already assume, rather than introducing new classes.

- [ ] **Step 3: Verify**

`npx tsc -b --noEmit`, `npm test` clean. Manually check `/#/stats` shows the new "Completion by lens" card with five rows and plausible fractions.

- [ ] **Step 4: Commit**

```bash
git add src/features/stats/StatsPage.vue
git commit -m "Add global lens-progress list to the Stats page"
```

---

### Task 9: Trainer medals — list to grid

**Files:**
- Modify: `src/features/trainer/TrainerPage.vue`
- Modify: `src/style.css` (add `.medal-grid`/`.medal-tile`)

**Interfaces:**
- Consumes: `Repository.listMedalProgress()`, `Repository.setMedalProgress()` — both already used by `TrainerPage.vue`, unchanged.

- [ ] **Step 1: Add grid CSS**

Add to `src/style.css`, near `.species-tile`'s grid definition (reuse the same `repeat(auto-fill, minmax(...))` pattern):

```css
.medal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.medal-tile {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-tag, 14px);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.medal-tile .medal-tile-name {
  font-weight: 700;
  font-size: 0.85rem;
}
.medal-tile .medal-tile-tier {
  font-size: 0.72rem;
  color: var(--muted);
}
```

If `--surface`/`--line`/`--muted`/`--radius-tag` tokens aren't already the exact names used elsewhere in `src/style.css`, use whatever the existing equivalents are named instead.

- [ ] **Step 2: Replace the medal list markup**

In `TrainerPage.vue`'s template, replace:

```html
    <div v-for="entry in sortedMedals" :key="entry.medal.slug" class="medal-row">
```

and its surrounding `<fieldset>` content with a `.medal-grid` wrapper containing one `.medal-tile` per `entry in sortedMedals`, preserving every existing piece of information (medal name, description, count input with its `@change` handler, "Tier N → next at X" / "Tier N (max)" note) — just re-laid-out into the tile shape instead of a full-width row. Do not change any `<script setup>` logic (`sortedMedals`, `updateCount`, `nextTarget`) — this task is template/CSS only.

- [ ] **Step 3: Verify**

`npx tsc -b --noEmit` clean. Manually check `/#/trainer` shows medals in a responsive grid instead of a scrolling list, and that editing a medal's count still works (tier auto-advances per `updateCount`'s existing logic).

- [ ] **Step 4: Commit**

```bash
git add src/features/trainer/TrainerPage.vue src/style.css
git commit -m "Change Trainer page medals from a list to a grid"
```

---

### Task 10: Final cleanup and whole-sub-project review

**Files:**
- Modify: `src/ui/dom.ts` (remove dead exports, if any)
- Modify: `docs/vue-migration-plan.md` (final Status pass)

**Interfaces:** none — this is a closing/verification task, not new functionality.

- [ ] **Step 1: Confirm `src/ui/dom.ts` has no remaining page-level callers**

`grep -rn "from .*ui/dom" src/` — after Tasks 1, 2, 4, 5, 6, 7 delete their vanilla files, `src/ui/dom.ts`'s `el`/`clear` helpers should have no remaining importers outside `src/app-shell/` (header/nav-drawer/etc., which stay vanilla per Global Constraints) and test fixtures. If any exports are now genuinely unused anywhere, remove them; if `el`/`clear` themselves are still used by app-shell chrome, leave the file in place (do not delete `dom.ts` itself).

- [ ] **Step 2: Full verification pass**

Run, in order: `npx tsc -b --noEmit`, `npm run lint`, `npm test`, `npx playwright test` (full suite). All must be clean.

- [ ] **Step 3: Final `docs/vue-migration-plan.md` pass**

Re-read the whole Status section and confirm it accurately reflects the finished state (no more "additive, not a Vue rewrite" notes for species detail/Dex grid, which are now full rewrites). Update the "Non-goals" section if anything there is no longer accurate (Search Tools/Coverage Report/Achievements/Help's non-goal note should now only mention Search Tools/Achievements, since Help and Coverage Report are done).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Final cleanup pass for Sub-project 3 (Vue migration completion)"
```

- [ ] **Step 5: Dispatch the final whole-sub-project code review**

Per `superpowers:subagent-driven-development`, generate the review package (`scripts/review-package` from that skill's directory, using the commit before Task 1 started as BASE and the current HEAD) and dispatch a final reviewer on the most capable available model before considering Sub-project 3 done.
