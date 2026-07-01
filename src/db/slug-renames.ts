// Hand-maintained registry of slug corrections. formSlug() (see
// scripts/ingest/slug.ts) is generated from a form's current display data
// (name/costume/gender), not assigned once and remembered — so fixing a
// mis-parsed display name (e.g. a costume ingested as "character", corrected
// to "Detective Pikachu") changes that form's slug. Without this registry,
// any personal data already keyed to the old slug would silently vanish the
// next time reference tables get refreshed (see reference-sync.ts, which
// applies these renames to form_personal/form_background_personal *before*
// the old form rows are deleted).
//
// Add an entry here whenever an ingestion fix changes an existing slug —
// never remove an entry once shipped, since a device that missed an update
// could still be one rename behind.
export interface SlugRename {
  table: "form_personal" | "form_background_personal";
  from: string;
  to: string;
}

// Empty for now — nothing has shipped to a real device yet, so no slug that
// used to exist in a released reference.json has since been renamed. The
// Detective Pikachu case (character -> Detective Pikachu) that motivated this
// file happened entirely within this same ingestion session, before any
// reference.json version reached a real repository install.
export const SLUG_RENAMES: SlugRename[] = [];
