// Sprite art convention: public/sprites/<dex-number zero-padded to 3>[-shiny].png,
// one pair per National Dex species (sourced from PokeMiners/pogo_assets via
// scripts/ingest/build-sprite-mapping.ts — see docs/v1-tasks/05-image-pipeline.md).
import formSpriteSlugsJson from "../data/form-sprite-slugs.json";

const formSpriteSlugs = new Set<string>(formSpriteSlugsJson);

export function speciesSpritePath(dexNumber: number, shiny = false): string {
  return `/sprites/${String(dexNumber).padStart(3, "0")}${shiny ? "-shiny" : ""}.png`;
}

// Per-form/costume art only exists for the form slugs build-sprite-mapping.ts
// confidently matched (public/sprites/forms/<form.slug>[-shiny].png) — most
// forms fall back to the species-level sprite. form-sprite-slugs.json is a
// committed manifest of which slugs have real art, since public/ is a
// bundled static folder, not something checkable at runtime.
export function formSpritePath(formSlug: string, dexNumber: number, shiny = false): string {
  if (formSpriteSlugs.has(formSlug)) {
    return `/sprites/forms/${formSlug}${shiny ? "-shiny" : ""}.png`;
  }
  return speciesSpritePath(dexNumber, shiny);
}
