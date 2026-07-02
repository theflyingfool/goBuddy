// Orchestrates the full reference-data build: Forms CSV skeleton (species/
// region/PoGo-availability) + PokeAPI (types/gender/legendary-mythical/
// mega-variant existence) + Partial-list CSV as a fallback where PokeAPI
// data is somehow missing. Emits src/data/reference.json (bundled app
// asset, committed to git) and src/data/reference-gaps.json (things worth
// a human double-checking, read by the Coverage Report page).
//
// Run with: npm run ingest:build (after npm run ingest:fetch has finished
// or at least made good progress — anything not yet cached gets fetched
// live here too, just slower).

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchPokeApi } from "./pokeapi-client";
import { parseFormsCsv } from "./parse-forms-csv";
import { parseTypesCsv } from "./parse-types-csv";
import { PUNCTUATION_FORM_NAMES, formSlug, megaVariantSlug, slugify } from "./slug";
import { generationForDex, ULTRA_BEAST_NAMES } from "./pokemon-facts";
import { detectStatelessGaps } from "./gap-detection";
import type { Form, Gender, MegaVariant, Rarity, Species } from "../../src/db/types";
import type { ReferenceData, ReferenceGap } from "../../src/db/reference-data";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const FORMS_CSV = resolve(REPO_ROOT, "Blank Pokedex Project (Living Column) - Forms w_ Dynamax.csv");
const TYPES_CSV = resolve(REPO_ROOT, "Refs from Obsidian/Partial pokemon list.csv");
const REFERENCE_OUT = resolve(REPO_ROOT, "src/data/reference.json");
const GAPS_OUT = resolve(REPO_ROOT, "src/data/reference-gaps.json");

interface PokeSpecies {
  id: number;
  name: string;
  gender_rate: number;
  is_legendary: boolean;
  is_mythical: boolean;
  evolves_from_species: { name: string; url: string } | null;
  varieties: { is_default: boolean; pokemon: { name: string; url: string } }[];
}

interface PokePokemon {
  types: { type: { name: string } }[];
}

const REGIONAL_SUFFIX: Record<string, string> = {
  alolan: "-alola",
  galarian: "-galar",
  hisuian: "-hisui",
  paldean: "-paldea",
};

function parentDexFromUrl(url: string): number | null {
  const match = url.match(/\/pokemon-species\/(\d+)\//);
  return match ? Number(match[1]) : null;
}

function guessVarietyName(pokeApiBaseName: string, formToken: string): { name: string; suffix: string } | null {
  const key = formToken.toLowerCase();
  for (const [prefix, suffix] of Object.entries(REGIONAL_SUFFIX)) {
    if (key.startsWith(prefix)) {
      const breedMatch = formToken.match(/\(([^)]+)\)/);
      if (breedMatch) {
        const breed = breedMatch[1].toLowerCase().replace(/\s+breed$/, "").trim().replace(/\s+/g, "-");
        return { name: `${pokeApiBaseName}${suffix}-${breed}-breed`, suffix };
      }
      return { name: `${pokeApiBaseName}${suffix}`, suffix };
    }
  }
  return null;
}

// Non-regional form tokens (letters, formes like Deoxys' Attack/Defense/
// Speed or Rotom's Heat/Wash, Alcremie flavors, ...) previously never got a
// match attempt at all — guessVarietyName only recognizes the four regional
// prefixes, so anything else fell straight through to a "missing-types" gap.
// PokeAPI's own variety names for these are near-always
// "${species}-${slugified-token}", but not always a byte-for-byte match —
// e.g. the Forms CSV's "Sandy Cloak" token slugifies to "sandy-cloak" while
// PokeAPI's actual variety is just "wormadam-sandy". Match bidirectionally:
// either the token or the variety's own suffix may be a prefix of the other.
function findVarietyByToken(pokeApiBaseName: string, formToken: string, varieties: PokeSpecies["varieties"]): string | null {
  const tokenSlug = slugify(PUNCTUATION_FORM_NAMES[formToken] ?? formToken);
  const prefix = `${pokeApiBaseName}-`;
  for (const v of varieties) {
    if (!v.pokemon.name.startsWith(prefix)) continue;
    const suffix = v.pokemon.name.slice(prefix.length);
    if (suffix === tokenSlug || tokenSlug.startsWith(`${suffix}-`) || suffix.startsWith(`${tokenSlug}-`)) {
      return v.pokemon.name;
    }
  }
  return null;
}

async function findFormTypes(
  baseName: string,
  baseTypes: string[],
  formToken: string | null,
  species: PokeSpecies,
  gaps: ReferenceGap[],
  speciesSlug: string,
  formSlugForGap: string,
): Promise<string[]> {
  if (formToken === null) return baseTypes;

  const guess = guessVarietyName(baseName, formToken);
  if (guess) {
    const variety = species.varieties.find((v) => v.pokemon.name === guess.name);
    if (variety) {
      const pokemon = await fetchPokeApi<PokePokemon>("pokemon", guess.name);
      return pokemon.types.map((t) => t.type.name);
    }
  } else {
    // No regional prefix matched — try the generic token-based match
    // instead of giving up immediately.
    const matched = findVarietyByToken(baseName, formToken, species.varieties);
    if (matched) {
      const pokemon = await fetchPokeApi<PokePokemon>("pokemon", matched);
      return pokemon.types.map((t) => t.type.name);
    }
  }

  // If PokeAPI doesn't list ANY variety in the same regional family (e.g.
  // no "-galar" variety at all, not just a name-match miss) for this
  // species, the CSV row is more likely a data-entry error (e.g. a
  // copy-paste artifact from an adjacent species row) than a real form we
  // just couldn't name-match — worth flagging distinctly so it doesn't get
  // lost among ordinary "couldn't guess the exact variety name" gaps. Only
  // applies to the regional case — a non-regional token with no PokeAPI
  // match is just an ordinary missing-types gap, not evidence of a bogus row.
  const hasMatchingRegionalVariety = guess && species.varieties.some((v) => v.pokemon.name.includes(guess.suffix));
  if (guess && !hasMatchingRegionalVariety) {
    gaps.push({
      kind: "possible-bogus-form",
      speciesSlug,
      formSlug: formSlugForGap,
      note: `The GO tracker CSV lists a "${formToken}" form for this species, but PokeAPI has no regional variety for it at all — this may be a data-entry error in the source CSV (e.g. a row duplicated from an adjacent species) rather than a real form. Verify manually.`,
    });
    return baseTypes;
  }

  gaps.push({
    kind: "missing-types",
    speciesSlug,
    formSlug: formSlugForGap,
    note: `Couldn't confidently match a PokeAPI variety for form "${formToken}" — using base-form types as a placeholder.`,
  });
  return baseTypes;
}

function deriveGender(genderRate: number): { hasMale: boolean; hasFemale: boolean } {
  if (genderRate === -1) return { hasMale: false, hasFemale: false }; // genderless
  if (genderRate === 0) return { hasMale: true, hasFemale: false }; // always male
  if (genderRate === 8) return { hasMale: false, hasFemale: true }; // always female
  return { hasMale: true, hasFemale: true };
}

function deriveRarity(poke: PokeSpecies): Rarity {
  if (poke.is_mythical) return "mythical";
  if (poke.is_legendary) return "legendary";
  if (ULTRA_BEAST_NAMES.has(poke.name)) return "ultra_beast";
  return "standard";
}

function gendersFor(hasMale: boolean, hasFemale: boolean): Gender[] {
  if (hasMale && hasFemale) return ["male", "female"];
  if (hasMale) return ["male"];
  if (hasFemale) return ["female"];
  return ["unknown"];
}

async function main() {
  console.log("Parsing Forms CSV skeleton...");
  let skeleton = parseFormsCsv(FORMS_CSV);
  // For local testing against a partially-fetched PokeAPI cache, e.g.
  // `INGEST_MAX_DEX=150 npm run ingest:build`. Unset in normal use.
  const maxDex = process.env.INGEST_MAX_DEX ? Number(process.env.INGEST_MAX_DEX) : undefined;
  if (maxDex) skeleton = skeleton.filter((s) => s.dexNumber <= maxDex);
  console.log(`  ${skeleton.length} species`);

  console.log("Parsing types fallback CSV...");
  const typesFallback = parseTypesCsv(TYPES_CSV);
  const typesFallbackMap = new Map(typesFallback.map((r) => [`${r.dexNumber}|${r.form}`, r.types]));

  const species: Species[] = [];
  const forms: Form[] = [];
  const formTypes: ReferenceData["formTypes"] = [];
  const megaVariants: MegaVariant[] = [];
  const gaps: ReferenceGap[] = [];

  const dexToFamilySlug = new Map<number, string>();
  const seenSlugs = new Set<string>();

  for (const parsed of skeleton) {
    const slug = slugify(parsed.name);
    if (seenSlugs.has(slug)) {
      throw new Error(`Duplicate species slug "${slug}" for dex #${parsed.dexNumber} (${parsed.name}) — needs disambiguation.`);
    }
    seenSlugs.add(slug);

    if (parsed.duplicateFormTokens.length > 0) {
      gaps.push({
        kind: "possible-bogus-form",
        speciesSlug: slug,
        note: `The GO tracker CSV lists this form more than once with conflicting data: ${parsed.duplicateFormTokens.join(", ")} — kept the more permissive (Shiny-available) copy. Likely a copy-paste artifact in the source CSV; verify manually.`,
      });
    }

    let hasMale = true;
    let hasFemale = true;
    let rarity: Rarity = "standard";
    let familySlug = slug;
    let baseTypes: string[] = typesFallbackMap.get(`${parsed.dexNumber}|Normal`) ?? [];
    let pokeSpecies: PokeSpecies | null = null;

    try {
      pokeSpecies = await fetchPokeApi<PokeSpecies>("pokemon-species", parsed.dexNumber);
      const gender = deriveGender(pokeSpecies.gender_rate);
      hasMale = gender.hasMale;
      hasFemale = gender.hasFemale;
      rarity = deriveRarity(pokeSpecies);

      const parentDex = pokeSpecies.evolves_from_species ? parentDexFromUrl(pokeSpecies.evolves_from_species.url) : null;
      familySlug = (parentDex && dexToFamilySlug.get(parentDex)) || slug;

      const pokePokemon = await fetchPokeApi<PokePokemon>("pokemon", parsed.dexNumber);
      baseTypes = pokePokemon.types.map((t) => t.type.name);
    } catch (err) {
      gaps.push({
        kind: "unverified-gender",
        speciesSlug: slug,
        note: `PokeAPI fetch failed for dex #${parsed.dexNumber} (${(err as Error).message}); gender/rarity/types default to best-effort placeholders.`,
      });
    }
    dexToFamilySlug.set(parsed.dexNumber, familySlug);

    // Mega variants: only for species the GO tracker (Forms CSV) says can
    // mega evolve — but flag if PokeAPI shows a mega variety exists and the
    // tracker disagrees, since that tracker can go stale (e.g. Kangaskhan).
    //
    // PokeAPI's dataset includes a non-canonical fan-content pack ("Mega
    // Dimension") that fabricates "-mega" varieties for species with no
    // official Mega Evolution at all (confirmed: "Mega Meganium" with a
    // made-up ability, version_group "mega-dimension"). Real Mega/Primal
    // forms only ever belong to version_group "x-y" or
    // "omega-ruby-alpha-sapphire" — filter on that rather than trusting
    // the variety name pattern alone.
    const candidateMegaNames = pokeSpecies?.varieties.map((v) => v.pokemon.name).filter((n) => /-mega(-[xy])?$|-primal$/.test(n)) ?? [];
    const megaVarietyNames: string[] = [];
    for (const candidate of candidateMegaNames) {
      const form = await fetchPokeApi<{ version_group: { name: string } }>("pokemon-form", candidate);
      if (form.version_group.name === "x-y" || form.version_group.name === "omega-ruby-alpha-sapphire") {
        megaVarietyNames.push(candidate);
      }
    }
    if (megaVarietyNames.length > 0 && !parsed.canMegaEvolve) {
      gaps.push({
        kind: "mega-discrepancy",
        speciesSlug: slug,
        note: `PokeAPI lists a mega variety (${megaVarietyNames.join(", ")}) but the GO tracker CSV marks Mega as unavailable — the tracker may predate this species' mega release. Verify manually.`,
      });
    }
    if (parsed.canMegaEvolve) {
      for (const varietyName of megaVarietyNames) {
        const variant = varietyName.endsWith("-mega-x") ? "X" : varietyName.endsWith("-mega-y") ? "Y" : varietyName.endsWith("-primal") ? "Primal" : null;
        megaVariants.push({ slug: megaVariantSlug(slug, variant), speciesSlug: slug, variant });
      }
      // Don't fabricate a placeholder mega_variant row when the tracker
      // says yes but PokeAPI can't confirm a real (canonical, non-fan-content)
      // mega evolution exists at all — that's more likely a tracker
      // data-entry error (confirmed for a few species: Uxie/Mesprit/Azelf/
      // Audino/Malamar/Falinks are marked mega-capable despite having no
      // official Mega Evolution) than a real gap to fill in.
      if (megaVarietyNames.length === 0 && pokeSpecies) {
        gaps.push({
          kind: "possible-bogus-form",
          speciesSlug: slug,
          note: "The GO tracker CSV marks this species as Mega-capable, but PokeAPI shows no official Mega Evolution for it at all — likely a tracker data-entry error. No mega_variant row was generated; verify manually.",
        });
      } else if (megaVarietyNames.length === 0) {
        // PokeAPI fetch failed entirely for this species — can't verify either way, so keep the old conservative placeholder.
        megaVariants.push({ slug: megaVariantSlug(slug, null), speciesSlug: slug, variant: null });
      }
    }

    species.push({
      slug,
      dexNumber: parsed.dexNumber,
      name: parsed.name,
      familySlug,
      gen: generationForDex(parsed.dexNumber),
      rarity,
      regionSlug: parsed.regionSlug,
      hasMale,
      hasFemale,
      canMegaEvolve: parsed.canMegaEvolve,
    });

    for (const parsedForm of parsed.forms) {
      for (const gender of gendersFor(hasMale, hasFemale)) {
        const fSlug = formSlug(slug, parsedForm.formToken, gender);
        const types = pokeSpecies
          ? await findFormTypes(pokeSpecies.name, baseTypes, parsedForm.formToken, pokeSpecies, gaps, slug, fSlug)
          : (typesFallbackMap.get(`${parsed.dexNumber}|${parsedForm.formToken ?? "Normal"}`) ?? baseTypes);

        const regionalExclusive = parsedForm.formToken !== null && /^(alolan|galarian|hisuian|paldean)/i.test(parsedForm.formToken);
        // Best-effort: base + regional-variant forms evolve like their
        // species; costumes/letters/formes generally don't in GO. Not
        // encoded in either source CSV — flagged for manual correction.
        const evolves = parsedForm.formToken === null || regionalExclusive;

        forms.push({
          slug: fSlug,
          speciesSlug: slug,
          formName: parsedForm.formToken ?? "Standard",
          costumeName: null,
          gender,
          evolves,
          shinyAvailable: parsedForm.shinyAvailable,
          shadowAvailable: parsed.shadowAvailable,
          dynamaxAvailable: parsed.dynamaxAvailable,
          gigantamaxAvailable: parsed.gigantamaxAvailable,
          regionalExclusive,
          imageRef: null,
        });

        for (const typeName of types) {
          formTypes.push({ formSlug: fSlug, typeSlug: slugify(typeName) });
        }
      }
    }
  }

  // Gap kinds that are a pure function of the final species/forms/formTypes
  // (no PokeAPI/CSV context needed) are computed once here via the shared
  // detector — see gap-detection.ts's header comment for why this is shared
  // with csv-authoring.ts's `import` command instead of only living here.
  gaps.push(...detectStatelessGaps(species, forms, formTypes));

  const allTypeSlugs = new Set(formTypes.map((ft) => ft.typeSlug));
  const referenceData: ReferenceData = {
    regions: [...new Set(skeleton.map((s) => s.regionSlug))].map((slug) => ({ slug, name: capitalize(slug) })),
    types: [...allTypeSlugs].map((slug) => ({ slug, name: capitalize(slug) })),
    // No data source exists yet for GO cosmetic backgrounds (neither CSV
    // nor PokeAPI tracks these) — two placeholders so the schema/UI have
    // something to demonstrate against; real background data is a known
    // gap to fill in later via the CSV authoring tool.
    backgrounds: [
      { slug: "spring-2024", name: "Spring 2024" },
      { slug: "anniversary-2016", name: "8th Anniversary" },
    ],
    species,
    forms,
    formTypes,
    megaVariants,
  };

  writeFileSync(REFERENCE_OUT, JSON.stringify(referenceData));
  writeFileSync(GAPS_OUT, JSON.stringify(gaps));

  console.log(`Wrote ${species.length} species, ${forms.length} forms, ${megaVariants.length} mega variants.`);
  console.log(`Wrote ${gaps.length} gap notes to ${GAPS_OUT}`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
