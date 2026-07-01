// Sprite art convention: public/sprites/<dex-number zero-padded to 3>.png,
// one per National Dex species (copied from the user's Obsidian vault
// thumbnails). Per-form/costume art isn't available yet — Form.imageRef
// stays reserved in the schema for when it is; until then every form of a
// species just falls back to this fixed species-level sprite path.
export function speciesSpritePath(dexNumber: number): string {
  return `/sprites/${String(dexNumber).padStart(3, "0")}.png`;
}
