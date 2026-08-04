import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpriteManifest } from "../scripts/ingest/transform/species";
import { createPokedexSource, type PokedexEntry } from "../scripts/ingest/sources/pokemon-go-api";
import type { Form } from "../src/db/types";

function formAt(overrides: Partial<Form>): Form {
  return {
    slug: "placeholder",
    speciesSlug: "placeholder",
    formName: "Standard",
    costumeName: null,
    gender: "unknown",
    evolves: true,
    shinyAvailable: false,
    shinyReleasedAt: null,
    shadowAvailable: false,
    dynamaxAvailable: false,
    regionalExclusive: false,
    imageRef: null,
    ...overrides,
  };
}

test("buildSpriteManifest maps a species-level slug to its asset URLs, independent of GAME_MASTER/shiny data", () => {
  const entries: PokedexEntry[] = [
    {
      id: "BULBASAUR",
      formId: "BULBASAUR",
      dexNr: 1,
      names: { English: "Bulbasaur" },
      assets: { image: "https://example.com/pm1.png", shinyImage: "https://example.com/pm1.s.png" },
    },
  ];
  const pokedex = createPokedexSource(entries);

  const manifest = buildSpriteManifest(pokedex, []);

  assert.deepEqual(manifest["bulbasaur"], {
    image: "https://example.com/pm1.png",
    shinyImage: "https://example.com/pm1.s.png",
  });
});

test("buildSpriteManifest covers every species-level slug the pokedex provides assets for", () => {
  const entries: PokedexEntry[] = [
    { id: "BULBASAUR", formId: "BULBASAUR", dexNr: 1, names: { English: "Bulbasaur" }, assets: { image: "https://example.com/pm1.png" } },
    { id: "IVYSAUR", formId: "IVYSAUR", dexNr: 2, names: { English: "Ivysaur" }, assets: { image: "https://example.com/pm2.png" } },
  ];
  const manifest = buildSpriteManifest(createPokedexSource(entries), []);
  assert.equal(manifest["bulbasaur"] !== undefined, true);
  assert.equal(manifest["ivysaur"] !== undefined, true);
});

test("buildSpriteManifest keys a genderless species' standard-form art under -unknown, not -male/-female, when the real forms list says so", () => {
  // Regression test: a first cut assumed every species has both genders
  // (gendersFor(true, true) unconditionally), which mismatched every
  // genderless species' real "-unknown" Form slug -- confirmed to drop
  // sprite art for 193 real forms (Arceus's 18 type variants among them)
  // when tested against the real pipeline.
  const entries: PokedexEntry[] = [
    {
      id: "MAGNEMITE",
      formId: "MAGNEMITE",
      dexNr: 81,
      names: { English: "Magnemite" },
      assets: { image: "https://example.com/pm81.png" },
    },
  ];
  const forms: Form[] = [formAt({ slug: "magnemite-standard-unknown", speciesSlug: "magnemite", gender: "unknown" })];

  const manifest = buildSpriteManifest(createPokedexSource(entries), forms);

  assert.ok(manifest["magnemite-standard-unknown"], "expected the -unknown slug to have art");
  assert.equal(manifest["magnemite-standard-male"], undefined);
  assert.equal(manifest["magnemite-standard-female"], undefined);
});

test("buildSpriteManifest still keys a gendered species' standard-form art under -male/-female when the real forms list says so", () => {
  const entries: PokedexEntry[] = [
    {
      id: "BULBASAUR",
      formId: "BULBASAUR",
      dexNr: 1,
      names: { English: "Bulbasaur" },
      assets: { image: "https://example.com/pm1.png" },
    },
  ];
  const forms: Form[] = [
    formAt({ slug: "bulbasaur-standard-male", speciesSlug: "bulbasaur", gender: "male" }),
    formAt({ slug: "bulbasaur-standard-female", speciesSlug: "bulbasaur", gender: "female" }),
  ];

  const manifest = buildSpriteManifest(createPokedexSource(entries), forms);

  assert.ok(manifest["bulbasaur-standard-male"]);
  assert.ok(manifest["bulbasaur-standard-female"]);
  assert.equal(manifest["bulbasaur-standard-unknown"], undefined);
});
