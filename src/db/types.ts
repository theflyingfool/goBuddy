// Mirrors the schema proposed in CLAUDE.md, plus additions agreed with the
// user along the way:
// - Form.gigantamaxAvailable, and AppSetting (personal UI-state table).
// - Form.shiny/luckyShiny/shadowShiny — CLAUDE.md's sketch had
//   dynamaxShiny/luckyDynamaxShiny but no plain shiny flag for the
//   base/lucky/shadow branches, even though the user's old Obsidian vault
//   treated "shiny" as its own tag independent of 4-star/floor-IV. Added
//   for consistency across all five branches.
// - FormBackgroundPersonal.achievementField — a background can be linked to
//   any specific tracked variant of a form (caught, lucky, shiny, shadow,
//   ...), not just "the form" generically, since those variants represent
//   distinct individually-owned Pokémon that can carry different
//   backgrounds. Always optional — no row means no background recorded.
// species.xxlAvailable/xxsAvailable were considered and dropped: XXL/XXS
// are always obtainable for any species in-game, so there's nothing to
// gate; only the personal "have I gotten one" fact
// (SpeciesPersonal.xxl/xxs) is meaningful.

export type Rarity = "standard" | "legendary" | "mythical" | "ultra_beast";
export type Gender = "male" | "female" | "unknown";
export type MegaVariantKind = "X" | "Y" | "Primal" | null;

// ---- Reference tables (replaceable wholesale, keyed by permanent slug) ----

export interface Region {
  slug: string;
  name: string;
}

export interface PokemonType {
  slug: string;
  name: string;
}

export interface Background {
  slug: string;
  name: string;
}

export interface Species {
  slug: string;
  dexNumber: number;
  name: string;
  familySlug: string;
  gen: number;
  rarity: Rarity;
  regionSlug: string;
  hasMale: boolean;
  hasFemale: boolean;
  canMegaEvolve: boolean;
}

export interface Form {
  slug: string;
  speciesSlug: string;
  formName: string;
  costumeName: string | null;
  gender: Gender;
  evolves: boolean;
  shinyAvailable: boolean;
  shadowAvailable: boolean;
  dynamaxAvailable: boolean;
  gigantamaxAvailable: boolean;
  regionalExclusive: boolean;
  imageRef: string | null;
}

export interface FormType {
  formSlug: string;
  typeSlug: string;
}

export interface MegaVariant {
  slug: string;
  speciesSlug: string;
  variant: MegaVariantKind;
}

// ---- Personal tables (never touched by reference updates) ----

export interface AppSetting {
  key: string;
  value: string;
}

export interface SpeciesPersonal {
  speciesSlug: string;
  registered: boolean;
  xxl: boolean;
  xxs: boolean;
  purified: boolean;
}

export interface FormPersonal {
  formSlug: string;

  caught: boolean;
  shiny: boolean;
  floor: boolean;
  fourStar: boolean;
  shundo: boolean;

  lucky: boolean;
  luckyShiny: boolean;
  luckyFloor: boolean;
  luckyFourStar: boolean;
  luckyShundo: boolean;

  shadow: boolean;
  shadowShiny: boolean;
  shadowFloor: boolean;
  shadowFourStar: boolean;
  shadowShundo: boolean;

  dynamax: boolean;
  dynamaxFloor: boolean;
  dynamaxShiny: boolean;
  dynamaxFourStar: boolean;
  dynamaxShundo: boolean;

  luckyDynamax: boolean;
  luckyDynamaxFloor: boolean;
  luckyDynamaxShiny: boolean;
  luckyDynamaxFourStar: boolean;
  luckyDynamaxShundo: boolean;

  bestShiny: string | null;
  bestNonShiny: string | null;
  bestLucky: string | null;
}

// Every independently-ownable variant of a form — used both to drive the
// data-entry toggle grid and as the set of things a background can be
// linked to (see FormBackgroundPersonal below).
export const FORM_PERSONAL_BOOLEAN_FIELDS = [
  "caught",
  "shiny",
  "floor",
  "fourStar",
  "shundo",
  "lucky",
  "luckyShiny",
  "luckyFloor",
  "luckyFourStar",
  "luckyShundo",
  "shadow",
  "shadowShiny",
  "shadowFloor",
  "shadowFourStar",
  "shadowShundo",
  "dynamax",
  "dynamaxFloor",
  "dynamaxShiny",
  "dynamaxFourStar",
  "dynamaxShundo",
  "luckyDynamax",
  "luckyDynamaxFloor",
  "luckyDynamaxShiny",
  "luckyDynamaxFourStar",
  "luckyDynamaxShundo",
] as const satisfies readonly (keyof FormPersonal)[];

export type FormPersonalBooleanField = (typeof FORM_PERSONAL_BOOLEAN_FIELDS)[number];

// camelCase TS field name -> snake_case SQL column name, so the two never
// drift apart and so form_background_personal.achievement_field can store
// the same identifier the DB column uses.
export const FORM_PERSONAL_FIELD_COLUMNS: Record<FormPersonalBooleanField, string> = {
  caught: "caught",
  shiny: "shiny",
  floor: "floor",
  fourStar: "four_star",
  shundo: "shundo",
  lucky: "lucky",
  luckyShiny: "lucky_shiny",
  luckyFloor: "lucky_floor",
  luckyFourStar: "lucky_four_star",
  luckyShundo: "lucky_shundo",
  shadow: "shadow",
  shadowShiny: "shadow_shiny",
  shadowFloor: "shadow_floor",
  shadowFourStar: "shadow_four_star",
  shadowShundo: "shadow_shundo",
  dynamax: "dynamax",
  dynamaxFloor: "dynamax_floor",
  dynamaxShiny: "dynamax_shiny",
  dynamaxFourStar: "dynamax_four_star",
  dynamaxShundo: "dynamax_shundo",
  luckyDynamax: "lucky_dynamax",
  luckyDynamaxFloor: "lucky_dynamax_floor",
  luckyDynamaxShiny: "lucky_dynamax_shiny",
  luckyDynamaxFourStar: "lucky_dynamax_four_star",
  luckyDynamaxShundo: "lucky_dynamax_shundo",
};

export interface FormBackgroundPersonal {
  formSlug: string;
  achievementField: FormPersonalBooleanField;
  backgroundSlug: string;
}

export interface MegaPersonal {
  megaVariantSlug: string;
  evolved: boolean;
  shinyEvolved: boolean;
}

export const SPECIES_PERSONAL_BOOLEAN_FIELDS = [
  "registered",
  "xxl",
  "xxs",
  "purified",
] as const satisfies readonly (keyof SpeciesPersonal)[];
