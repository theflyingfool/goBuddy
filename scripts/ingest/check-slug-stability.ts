// Fails if a reference-data ingestion pass removed a slug that a personal
// row could be pinned to, without a matching entry in src/db/slug-renames.ts
// to carry that personal data forward. Run this after `ingest:build` and
// before committing/merging a reference-data change — see
// docs/ingestion-runbook.md and docs/v1-tasks/01-reference-data-correction.md.
//
// Only form slugs have a rename mechanism at all (SLUG_RENAMES only covers
// form_personal/form_background_personal — see slug-renames.ts). Species and
// mega-variant slugs have no such registry, so any disappearance there is
// always reported as a failure; teaching the app to carry those renames
// forward is out of scope here (tracked as part of the V2 identity/slug
// rework, docs/v1-tasks/09-v2-watchlist.md).
//
// Compares the working tree's src/data/reference.json against the last
// *committed* version (`git show HEAD:...`), i.e. exactly the manual check
// docs/ingestion-runbook.md already asked contributors to do by hand.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReferenceData } from "../../src/db/reference-data";
import { SLUG_RENAMES } from "../../src/db/slug-renames";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const REFERENCE_JSON_PATH = "src/data/reference.json";

interface SlugSet {
  species: Set<string>;
  forms: Set<string>;
  megaVariants: Set<string>;
}

function slugsOf(data: ReferenceData): SlugSet {
  return {
    species: new Set(data.species.map((s) => s.slug)),
    forms: new Set(data.forms.map((f) => f.slug)),
    megaVariants: new Set(data.megaVariants.map((m) => m.slug)),
  };
}

function loadWorkingTree(): ReferenceData {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, REFERENCE_JSON_PATH), "utf-8")) as ReferenceData;
}

function loadCommitted(): ReferenceData | null {
  try {
    const content = execFileSync("git", ["show", `HEAD:${REFERENCE_JSON_PATH}`], { cwd: REPO_ROOT, encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 });
    return JSON.parse(content) as ReferenceData;
  } catch {
    // No committed version yet (e.g. brand-new repo) — nothing to diff against.
    return null;
  }
}

function main(): void {
  const committed = loadCommitted();
  if (!committed) {
    console.log("No committed src/data/reference.json to compare against — skipping.");
    return;
  }

  const before = slugsOf(committed);
  const after = slugsOf(loadWorkingTree());
  const renamedFormSlugs = new Set(SLUG_RENAMES.filter((r) => r.table === "form_personal").map((r) => r.from));

  const problems: string[] = [];

  for (const slug of before.species) {
    if (!after.species.has(slug)) problems.push(`species slug disappeared (no rename mechanism exists for species): "${slug}"`);
  }
  for (const slug of before.megaVariants) {
    if (!after.megaVariants.has(slug)) problems.push(`mega_variant slug disappeared (no rename mechanism exists for mega variants): "${slug}"`);
  }
  for (const slug of before.forms) {
    if (after.forms.has(slug)) continue;
    if (renamedFormSlugs.has(slug)) continue;
    problems.push(`form slug disappeared without a matching src/db/slug-renames.ts entry: "${slug}"`);
  }

  if (problems.length > 0) {
    console.error(`Slug stability check failed — ${problems.length} slug(s) vanished unaccounted for:\n`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error("\nIf this is intentional (e.g. a pre-release correction, or a real rename), either:");
    console.error("  - add a src/db/slug-renames.ts entry (form slugs only), or");
    console.error("  - confirm no real device has this slug's personal data yet, then ignore.");
    process.exitCode = 1;
    return;
  }

  console.log(`Slug stability check passed (${before.species.size} species, ${before.forms.size} forms, ${before.megaVariants.size} mega variants checked).`);
}

main();
