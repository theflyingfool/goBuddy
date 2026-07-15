import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveFormFieldCascade } from "../src/db/cascades";

function resolvedSorted(field: Parameters<typeof resolveFormFieldCascade>[0]) {
  return resolveFormFieldCascade(field).sort();
}

test("within-section cascades still work: Standard Shundo implies shiny/fourStar/caught", () => {
  assert.deepEqual(resolvedSorted("shundo"), ["caught", "fourStar", "shiny"].sort());
});

test("within-section cascades still work: Dynamax Shundo implies its own shiny/fourStar/base", () => {
  assert.deepEqual(resolvedSorted("dynamaxShundo"), ["dynamax", "dynamaxFourStar", "dynamaxShiny", "caught"].sort());
});

test("any section's base cascades up to Standard/Caught", () => {
  assert.deepEqual(resolvedSorted("lucky"), ["caught"]);
  assert.deepEqual(resolvedSorted("shadow"), ["caught"]);
  assert.deepEqual(resolvedSorted("dynamax"), ["caught"]);
  assert.deepEqual(resolvedSorted("luckyDynamax"), ["caught"]);
});

test("Floor IV in any section only implies caught (its own base + Standard/Caught), nothing richer", () => {
  assert.deepEqual(resolvedSorted("floor"), ["caught"]);
  assert.deepEqual(resolvedSorted("luckyFloor"), ["caught", "lucky"].sort());
  assert.deepEqual(resolvedSorted("shadowFloor"), ["caught", "shadow"].sort());
});

test("Lucky Shiny promotes Standard Shiny (owner spec: 'Lucky Shiny should fill Standard Shiny')", () => {
  assert.deepEqual(resolvedSorted("luckyShiny"), ["caught", "lucky", "shiny"].sort());
});

test("Lucky Shundo promotes Standard Shundo/4-Star/Shiny/Caught plus lucky 4-Star/Shiny (owner spec, full list)", () => {
  assert.deepEqual(
    resolvedSorted("luckyShundo"),
    ["caught", "fourStar", "shiny", "shundo", "lucky", "luckyFourStar", "luckyShiny"].sort(),
  );
});

test("Shadow/Dynamax Shiny do NOT promote Standard Shiny — different acquisition path, not the same individual", () => {
  assert.ok(!resolveFormFieldCascade("shadowShiny").includes("shiny"));
  assert.ok(!resolveFormFieldCascade("dynamaxShiny").includes("shiny"));
});

test("Shadow/Dynamax Shundo do NOT promote Standard Shundo, only their own section", () => {
  assert.deepEqual(resolvedSorted("shadowShundo"), ["caught", "shadow", "shadowFourStar", "shadowShiny"].sort());
  assert.deepEqual(resolvedSorted("dynamaxShundo"), ["caught", "dynamax", "dynamaxFourStar", "dynamaxShiny"].sort());
});
