// Manual authoring workflow for reference data: export the current dataset
// to a flat CSV for review, hand a blank template for adding new entries
// (e.g. a costume that just shipped and isn't in any automated source),
// and import a filled-in CSV back into src/data/reference.json.
//
// Usage:
//   tsx scripts/ingest/csv-authoring.ts export
//   tsx scripts/ingest/csv-authoring.ts template
//   tsx scripts/ingest/csv-authoring.ts import [path]   (default: data-authoring/new-entries.csv)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { formSlug as buildFormSlug, slugify } from "./slug";
import { detectStatelessGaps, STATELESS_GAP_KINDS } from "./gap-detection";
import { REFERENCE_CSV_COLUMNS as COLUMNS, formToCsvRow, referenceRowsToCsv } from "../../src/data/reference-csv-format";
import type { ReferenceData, ReferenceGap } from "../../src/db/reference-data";
import type { Form, Gender, Rarity, Species } from "../../src/db/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const REFERENCE_PATH = resolve(REPO_ROOT, "src/data/reference.json");
const GAPS_PATH = resolve(REPO_ROOT, "src/data/reference-gaps.json");
const AUTHORING_DIR = resolve(REPO_ROOT, "data-authoring");
const EXPORT_PATH = resolve(AUTHORING_DIR, "reference-export.csv");
const TEMPLATE_PATH = resolve(AUTHORING_DIR, "new-entries-template.csv");
const DEFAULT_IMPORT_PATH = resolve(AUTHORING_DIR, "new-entries.csv");

function writeCsv(path: string, rows: string[][]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, referenceRowsToCsv(rows));
}

/** Minimal quoted-CSV line parser — handles the `"a,b""c"` escaping csvEscape produces. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function loadReference(): ReferenceData {
  if (!existsSync(REFERENCE_PATH)) {
    throw new Error(`${REFERENCE_PATH} doesn't exist yet — run "npm run ingest:build" first.`);
  }
  return JSON.parse(readFileSync(REFERENCE_PATH, "utf-8"));
}

function saveReference(data: ReferenceData) {
  writeFileSync(REFERENCE_PATH, JSON.stringify(data));
}

function runExport() {
  const data = loadReference();
  const rows = data.forms.map((form) => formToCsvRow(data, form));
  writeCsv(EXPORT_PATH, rows);
  console.log(`Wrote ${rows.length} rows to ${EXPORT_PATH}`);
}

function runTemplate() {
  writeCsv(TEMPLATE_PATH, []);
  console.log(`Wrote blank template to ${TEMPLATE_PATH}`);
}

function parseBool(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

function runImport(path: string) {
  if (!existsSync(path)) throw new Error(`Import file not found: ${path}`);
  const data = loadReference();
  const speciesBySlug = new Map(data.species.map((s) => [s.slug, s]));
  const formsBySlug = new Map(data.forms.map((f) => [f.slug, f]));

  const lines = readFileSync(path, "utf-8").split("\n").filter((l) => l.trim());
  // Map cells by the file's OWN header names, not by fixed COLUMNS position, so
  // an older export whose column order predates a schema change (e.g. a
  // costume CSV written before can_gigantamax was added) still imports
  // correctly: known columns line up by name, obsolete columns are ignored,
  // and columns absent from the file default to "" (never undefined).
  const headerCells = parseCsvLine(lines[0]).map((h) => h.trim());
  const dataLines = lines.slice(1);

  let inserted = 0;
  let updated = 0;
  const touchedSpeciesSlugs = new Set<string>();
  const touchedFormSlugs = new Set<string>();

  for (const line of dataLines) {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(COLUMNS.map((col) => [col, ""])) as Record<(typeof COLUMNS)[number], string>;
    headerCells.forEach((col, i) => {
      if (col in row) row[col as (typeof COLUMNS)[number]] = cells[i] ?? "";
    });

    const speciesSlug = row.species_slug.trim() || slugify(row.species_name);
    if (!speciesBySlug.has(speciesSlug)) {
      const newSpecies: Species = {
        slug: speciesSlug,
        dexNumber: Number(row.dex_number),
        name: row.species_name,
        familySlug: row.family_slug || speciesSlug,
        gen: Number(row.generation),
        rarity: (row.rarity || "standard") as Rarity,
        regionSlug: row.region_slug,
        hasMale: parseBool(row.has_male),
        hasFemale: parseBool(row.has_female),
        canMegaEvolve: parseBool(row.can_mega_evolve),
        canGigantamax: parseBool(row.can_gigantamax),
      };
      data.species.push(newSpecies);
      speciesBySlug.set(speciesSlug, newSpecies);
    }

    touchedSpeciesSlugs.add(speciesSlug);

    const gender = (row.gender || "unknown") as Gender;
    const fSlug = row.form_slug.trim() || buildFormSlug(speciesSlug, row.form_name || null, gender, row.costume_name || null);
    touchedFormSlugs.add(fSlug);

    const newForm: Form = {
      slug: fSlug,
      speciesSlug,
      formName: row.form_name || "Standard",
      costumeName: row.costume_name || null,
      gender,
      evolves: parseBool(row.evolves),
      shinyAvailable: parseBool(row.shiny_available),
      shadowAvailable: parseBool(row.shadow_available),
      dynamaxAvailable: parseBool(row.dynamax_available),
      regionalExclusive: parseBool(row.regional_exclusive),
      imageRef: row.image_ref || null,
    };

    if (formsBySlug.has(fSlug)) {
      const index = data.forms.findIndex((f) => f.slug === fSlug);
      data.forms[index] = newForm;
      updated++;
    } else {
      data.forms.push(newForm);
      inserted++;
    }
    formsBySlug.set(fSlug, newForm);

    data.formTypes = data.formTypes.filter((ft) => ft.formSlug !== fSlug);
    const types = row.types
      .split(";")
      .map((t) => t.trim())
      .filter(Boolean);
    for (const typeName of types) {
      const typeSlug = slugify(typeName);
      if (!data.types.some((t) => t.slug === typeSlug)) data.types.push({ slug: typeSlug, name: typeName });
      data.formTypes.push({ formSlug: fSlug, typeSlug });
    }
  }

  saveReference(data);
  console.log(`Imported ${dataLines.length} rows from ${path}: ${inserted} new form(s), ${updated} updated.`);

  // Keep the Coverage Report in sync: without this, a gap a human just fixed
  // by hand via this exact CSV round-trip would keep showing up until the
  // next full `npm run ingest:build` (see TODO.md's "Coverage Report was
  // stale" entry). Only the stateless gap kinds (derivable purely from
  // reference.json — see gap-detection.ts) can be refreshed here; kinds that
  // depend on PokeAPI/the Forms CSV/Bulbapedia are left as whatever the last
  // full build or event-parse run recorded.
  //
  // Scoped to the species/forms this import actually touched, not a full
  // recompute over the whole dataset: several forms elsewhere in
  // reference.json carry a "missing-types" gap for a placeholder types list
  // that's non-empty (just wrong) — see gap-detection.ts's header comment —
  // so a dataset-wide recompute would silently drop those still-unresolved
  // gaps just because an unrelated row got imported. Only entries for rows
  // this run actually reviewed are safe to replace.
  const existingGaps: ReferenceGap[] = existsSync(GAPS_PATH) ? JSON.parse(readFileSync(GAPS_PATH, "utf-8")) : [];
  const keptGaps = existingGaps.filter((g) => {
    if (!STATELESS_GAP_KINDS.includes(g.kind)) return true; // not recomputable here — leave untouched
    const touched = g.formSlug ? touchedFormSlugs.has(g.formSlug) : touchedSpeciesSlugs.has(g.speciesSlug);
    return !touched;
  });
  const touchedSpecies = data.species.filter((s) => touchedSpeciesSlugs.has(s.slug));
  const touchedForms = data.forms.filter((f) => touchedFormSlugs.has(f.slug));
  const freshGaps = detectStatelessGaps(touchedSpecies, touchedForms, data.formTypes);
  writeFileSync(GAPS_PATH, JSON.stringify([...keptGaps, ...freshGaps]));
  console.log(`Refreshed ${GAPS_PATH.replace(REPO_ROOT + "/", "")}: ${keptGaps.length} kept + ${freshGaps.length} recomputed gap(s) for this import's rows.`);
}

const [, , mode, arg] = process.argv;

if (mode === "export") runExport();
else if (mode === "template") runTemplate();
else if (mode === "import") runImport(arg ?? DEFAULT_IMPORT_PATH);
else {
  console.error("Usage: tsx scripts/ingest/csv-authoring.ts <export|template|import> [path]");
  process.exit(1);
}
