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
import type { ReferenceData } from "../../src/db/reference-data";
import type { Form, Gender, Rarity, Species } from "../../src/db/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const REFERENCE_PATH = resolve(REPO_ROOT, "src/data/reference.json");
const AUTHORING_DIR = resolve(REPO_ROOT, "data-authoring");
const EXPORT_PATH = resolve(AUTHORING_DIR, "reference-export.csv");
const TEMPLATE_PATH = resolve(AUTHORING_DIR, "new-entries-template.csv");
const DEFAULT_IMPORT_PATH = resolve(AUTHORING_DIR, "new-entries.csv");

const COLUMNS = [
  "species_slug",
  "dex_number",
  "species_name",
  "family_slug",
  "generation",
  "rarity",
  "region_slug",
  "has_male",
  "has_female",
  "can_mega_evolve",
  "form_slug",
  "form_name",
  "costume_name",
  "gender",
  "evolves",
  "shiny_available",
  "shadow_available",
  "dynamax_available",
  "gigantamax_available",
  "regional_exclusive",
  "image_ref",
  "types",
] as const;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function writeCsv(path: string, rows: string[][]) {
  mkdirSync(dirname(path), { recursive: true });
  const content = [COLUMNS.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n") + "\n";
  writeFileSync(path, content);
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

function typesForForm(data: ReferenceData, formSlug: string): string {
  return data.formTypes
    .filter((ft) => ft.formSlug === formSlug)
    .map((ft) => ft.typeSlug)
    .join(";");
}

function runExport() {
  const data = loadReference();
  const speciesBySlug = new Map(data.species.map((s) => [s.slug, s]));
  const rows = data.forms.map((form) => {
    const species = speciesBySlug.get(form.speciesSlug);
    if (!species) throw new Error(`Form ${form.slug} references unknown species ${form.speciesSlug}`);
    return [
      species.slug,
      String(species.dexNumber),
      species.name,
      species.familySlug,
      String(species.gen),
      species.rarity,
      species.regionSlug,
      String(species.hasMale),
      String(species.hasFemale),
      String(species.canMegaEvolve),
      form.slug,
      form.formName,
      form.costumeName ?? "",
      form.gender,
      String(form.evolves),
      String(form.shinyAvailable),
      String(form.shadowAvailable),
      String(form.dynamaxAvailable),
      String(form.gigantamaxAvailable),
      String(form.regionalExclusive),
      form.imageRef ?? "",
      typesForForm(data, form.slug),
    ];
  });
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
  const [, ...dataLines] = lines; // drop header

  let inserted = 0;
  let updated = 0;

  for (const line of dataLines) {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(COLUMNS.map((col, i) => [col, cells[i] ?? ""])) as Record<(typeof COLUMNS)[number], string>;

    let speciesSlug = row.species_slug.trim() || slugify(row.species_name);
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
      };
      data.species.push(newSpecies);
      speciesBySlug.set(speciesSlug, newSpecies);
    }

    const gender = (row.gender || "unknown") as Gender;
    const fSlug = row.form_slug.trim() || buildFormSlug(speciesSlug, row.form_name || null, gender);

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
      gigantamaxAvailable: parseBool(row.gigantamax_available),
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
}

const [, , mode, arg] = process.argv;

if (mode === "export") runExport();
else if (mode === "template") runTemplate();
else if (mode === "import") runImport(arg ?? DEFAULT_IMPORT_PATH);
else {
  console.error("Usage: tsx scripts/ingest/csv-authoring.ts <export|template|import> [path]");
  process.exit(1);
}
