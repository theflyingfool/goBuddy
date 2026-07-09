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
// catchable set with no independently catchable base — Unown was the first
// known case (28 letters + "!"/"?", none of which is a distinct "Standard"
// Unown; the header row is purely a label the 28 sub-rows hang off of).
// Species listed here have their header-row "Standard" form dropped.
//
// The other 15 species below are the same phantom-row bug, found in the
// V1 reference-data pass: each has a real named default sub-row (Deoxys'
// "Normal", Furfrou's "Natural", ...) that the phantom "Standard" row
// silently duplicated. Unlike Unown, the CSV's Shiny column for these was
// only ever filled in on the header row, not the sub-rows (all dashed) —
// so dropping the header without migrating that flag would have quietly
// made every one of these species look shiny-unavailable. The corresponding
// CSV edit copies the header's Shiny flag onto the real default sub-row for
// each. Three of them — Basculin, Oricorio, and Vivillon (color/pattern
// variants) — have no single default form to migrate to, so the header's
// flag was conservatively copied onto *every* variant instead of picking
// one arbitrarily; this may overclaim Shiny for a specific pattern/color
// that isn't actually released yet in GO and is worth a manual pass later.
export const NO_STANDARD_FORM_NAMES = new Set([
  "unown",
  "deoxys",
  "giratina",
  "shaymin",
  "zygarde",
  "hoopa",
  "genesect",
  "basculin",
  "oricorio",
  "sinistea",
  "urshifu",
  "enamorus",
  "furfrou",
  "vivillon",
  "maushold",
  "dudunsparce",
]);
