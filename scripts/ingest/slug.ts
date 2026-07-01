// Shared slug generation — used by build-reference.ts and csv-authoring.ts
// so a manually-added CSV row and an automated ingestion row never collide
// or diverge on how a slug gets built.

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "") // strip accents, e.g. Flabébé -> Flabebe
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Punctuation-only form tokens (Unown's "!" and "?" forms) slugify to an
// empty string and would otherwise collide with each other — spell them out.
const PUNCTUATION_FORM_NAMES: Record<string, string> = {
  "!": "exclamation",
  "?": "question",
};

export function formSlug(speciesSlug: string, formToken: string | null, gender: string): string {
  const token = formToken ? slugify(PUNCTUATION_FORM_NAMES[formToken] ?? formToken) : "standard";
  return `${speciesSlug}-${token}-${gender}`;
}

export function megaVariantSlug(speciesSlug: string, variant: "X" | "Y" | "Primal" | null): string {
  return variant ? `${speciesSlug}-mega-${variant.toLowerCase()}` : `${speciesSlug}-mega`;
}
