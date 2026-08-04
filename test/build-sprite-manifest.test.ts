import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpriteManifest } from "../scripts/ingest/transform/species";
import { createPokedexSource, type PokedexEntry } from "../scripts/ingest/sources/pokemon-go-api";

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

  const manifest = buildSpriteManifest(pokedex);

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
  const manifest = buildSpriteManifest(createPokedexSource(entries));
  assert.equal(manifest["bulbasaur"] !== undefined, true);
  assert.equal(manifest["ivysaur"] !== undefined, true);
});
