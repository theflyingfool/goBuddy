import { test } from "node:test";
import assert from "node:assert/strict";

import { matchesCaughtFilter } from "../src/features/data-entry/bulk-form-edit";

// Regression coverage for the "Caught/Uncaught based on species registered
// instead of form caught" bug: Bulk Edit's Caught/Uncaught filter must judge
// a form-group tile by its own forms' `caught` booleans, never by the
// species-wide `registered` flag. A species can be `registered: true` (any
// form ever caught) while a *specific* form/group under it is still
// uncaught, and vice versa a species can have `registered: false` while
// none of its forms are caught — matchesCaughtFilter never sees `registered`
// at all, only the per-form caught booleans passed in.

test("'all' keeps every group regardless of caught state", () => {
  assert.equal(matchesCaughtFilter("all", [false, false]), true);
  assert.equal(matchesCaughtFilter("all", [true, false]), true);
  assert.equal(matchesCaughtFilter("all", []), true);
});

test("'caught' keeps a group with at least one caught form", () => {
  assert.equal(matchesCaughtFilter("caught", [true]), true);
  // Species-registered-true, but the OTHER form of the species is the one
  // caught — this specific group still has one caught form, so it's kept.
  assert.equal(matchesCaughtFilter("caught", [true, false]), true);
});

test("'caught' drops a group where every form is still uncaught, even if the species is registered", () => {
  // This is the exact bug scenario: species.registered is true (some
  // sibling form was caught) but THIS group's own forms are all uncaught.
  assert.equal(matchesCaughtFilter("caught", [false, false]), false);
  assert.equal(matchesCaughtFilter("caught", [false]), false);
});

test("'uncaught' keeps a group only when none of its forms are caught", () => {
  assert.equal(matchesCaughtFilter("uncaught", [false, false]), true);
  assert.equal(matchesCaughtFilter("uncaught", [true, false]), false);
  assert.equal(matchesCaughtFilter("uncaught", [true]), false);
});
