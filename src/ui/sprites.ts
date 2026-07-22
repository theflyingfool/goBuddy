// Sprite art convention: public/sprites/<dex-number zero-padded to 3>[-shiny].webp,
// one pair per National Dex species (sourced from pokemon-go-api's assets
// repo via scripts/ingest/build-sprites.ts, converted from the originals
// to WebP for size).
import formSpriteSlugsJson from "../data/form-sprite-slugs.json";
import megaSpriteSlugsJson from "../data/mega-sprite-slugs.json";

const formSpriteSlugs = new Set<string>(formSpriteSlugsJson);
const megaSpriteSlugs = new Set<string>(megaSpriteSlugsJson);

export function speciesSpritePath(dexNumber: number, shiny = false): string {
  return `/sprites/${String(dexNumber).padStart(3, "0")}${shiny ? "-shiny" : ""}.webp`;
}

// Per-form/costume art only exists for the form slugs build-sprites.ts
// confidently matched (public/sprites/forms/<form.slug>[-shiny].webp) — most
// forms fall back to the species-level sprite. form-sprite-slugs.json is a
// committed manifest of which slugs have real art, since public/ is a
// bundled static folder, not something checkable at runtime.
export function formSpritePath(formSlug: string, dexNumber: number, shiny = false): string {
  if (formSpriteSlugs.has(formSlug)) {
    return `/sprites/forms/${formSlug}${shiny ? "-shiny" : ""}.webp`;
  }
  return speciesSpritePath(dexNumber, shiny);
}

// Mega/Primal art (public/sprites/mega/<megaVariant.slug>[-shiny].webp) — a
// separate manifest since megaVariants is its own reference table, not a
// form. Falls back to the species-level sprite for any variant with no
// dedicated art.
export function megaSpritePath(megaVariantSlug: string, dexNumber: number, shiny = false): string {
  if (megaSpriteSlugs.has(megaVariantSlug)) {
    return `/sprites/mega/${megaVariantSlug}${shiny ? "-shiny" : ""}.webp`;
  }
  return speciesSpritePath(dexNumber, shiny);
}
