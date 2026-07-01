// Small hand-maintained facts PokeAPI doesn't cleanly expose as a flag.

// Ultra Beasts aren't tagged by any PokeAPI boolean — this is the complete,
// stable list (Gen 7 only; nothing since has been classified as one).
export const ULTRA_BEAST_NAMES = new Set([
  "nihilego",
  "buzzwole",
  "pheromosa",
  "xurkitree",
  "celesteela",
  "kartana",
  "guzzlord",
  "poipole",
  "naganadel",
  "stakataka",
  "blacephalon",
]);

// Generation-by-dex-number is simpler and more reliable to hardcode than
// parsing PokeAPI's roman-numeral generation name.
const GENERATION_MAX_DEX = [
  [151, 1],
  [251, 2],
  [386, 3],
  [493, 4],
  [649, 5],
  [721, 6],
  [809, 7],
  [905, 8],
  [1025, 9],
] as const;

export function generationForDex(dexNumber: number): number {
  for (const [maxDex, gen] of GENERATION_MAX_DEX) {
    if (dexNumber <= maxDex) return gen;
  }
  return GENERATION_MAX_DEX[GENERATION_MAX_DEX.length - 1][1];
}

// The Forms tracker CSV always represents a species as one header row
// (implicitly treated as its own catchable "Standard" form) followed by
// zero or more indented sub-rows for additional variants/costumes/formes.
// That assumption is wrong for species whose sub-rows are the *entire*
// catchable set with no independently catchable base — Unown is the only
// known case (28 letters + "!"/"?", none of which is a distinct "Standard"
// Unown; the header row is purely a label the 28 sub-rows hang off of).
// Species listed here have their header-row "Standard" form dropped.
export const NO_STANDARD_FORM_NAMES = new Set(["unown"]);
