// Real parameterized SQL for the completion-stats feature (CLAUDE.md
// Feature 1) — one query shape per lens kind, parameterized by scope
// (region / species / global), rather than hand-rolled queries per region or
// per achievement column. This is the "real" implementation used by the
// SQLite-backed repository; src/data/in-memory-store.ts has an equivalent
// computed in plain JS for the dummy backend (same semantics, no SQL).

import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { FORM_PERSONAL_BOOLEAN_FIELDS, FORM_PERSONAL_FIELD_COLUMNS, type FormPersonalBooleanField } from "../db/types";
import type { CompletionLens, CompletionLensResult, CompletionMissingSpecies, CompletionScope } from "./repository";

interface ScopeClause {
  where: string;
  params: unknown[];
}

function scopeClause(scope: CompletionScope): ScopeClause {
  switch (scope.kind) {
    case "region":
      return { where: "s.region_slug = ?", params: [scope.regionSlug] };
    case "species":
      return { where: "s.slug = ?", params: [scope.speciesSlug] };
    case "global":
      return { where: "1 = 1", params: [] };
  }
}

interface SpeciesRow {
  slug: string;
  name: string;
  dex_number: number;
}

async function selectMissingSpecies(db: SQLiteDBConnection, sql: string, params: unknown[]): Promise<CompletionMissingSpecies[]> {
  const rows = ((await db.query(sql, params)).values ?? []) as SpeciesRow[];
  return rows.map((r) => ({ slug: r.slug, name: r.name, dexNumber: r.dex_number }));
}

async function countSpecies(db: SQLiteDBConnection, where: string, params: unknown[]): Promise<number> {
  const rows = (await db.query(`SELECT COUNT(*) as c FROM species s WHERE ${where}`, params)).values ?? [];
  return (rows[0] as { c: number } | undefined)?.c ?? 0;
}

async function registeredLens(db: SQLiteDBConnection, scope: CompletionScope): Promise<Omit<CompletionLensResult, "lens">> {
  const { where, params } = scopeClause(scope);
  const total = await countSpecies(db, where, params);
  const missingSpecies = await selectMissingSpecies(
    db,
    `SELECT s.slug, s.name, s.dex_number FROM species s
     LEFT JOIN species_personal sp ON sp.species_slug = s.slug
     WHERE ${where} AND (sp.registered IS NULL OR sp.registered = 0)`,
    params,
  );
  return { total, complete: total - missingSpecies.length, missingSpecies };
}

async function formCompleteLens(db: SQLiteDBConnection, scope: CompletionScope): Promise<Omit<CompletionLensResult, "lens">> {
  const { where, params } = scopeClause(scope);
  const total = await countSpecies(db, where, params);
  const missingSpecies = await selectMissingSpecies(
    db,
    `SELECT s.slug, s.name, s.dex_number FROM species s
     WHERE ${where} AND EXISTS (
       SELECT 1 FROM form f LEFT JOIN form_personal fp ON fp.form_slug = f.slug
       WHERE f.species_slug = s.slug AND f.costume_name IS NULL AND (fp.caught IS NULL OR fp.caught = 0)
     )`,
    params,
  );
  return { total, complete: total - missingSpecies.length, missingSpecies };
}

async function costumeCompleteLens(db: SQLiteDBConnection, scope: CompletionScope): Promise<Omit<CompletionLensResult, "lens">> {
  const { where, params } = scopeClause(scope);
  // Denominator is species that actually have a costume — most species never
  // got one, and counting them as trivially "complete" would make this stat
  // meaningless (inflated by species with nothing to catch at all).
  const totalRows = (await db.query(`SELECT COUNT(DISTINCT s.slug) as c FROM species s JOIN form f ON f.species_slug = s.slug WHERE ${where} AND f.costume_name IS NOT NULL`, params)).values ?? [];
  const total = (totalRows[0] as { c: number } | undefined)?.c ?? 0;
  const missingSpecies = await selectMissingSpecies(
    db,
    `SELECT DISTINCT s.slug, s.name, s.dex_number FROM species s
     JOIN form f2 ON f2.species_slug = s.slug
     WHERE ${where} AND f2.costume_name IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM form f LEFT JOIN form_personal fp ON fp.form_slug = f.slug
       WHERE f.species_slug = s.slug AND f.costume_name IS NOT NULL AND (fp.caught IS NULL OR fp.caught = 0)
     )`,
    params,
  );
  return { total, complete: total - missingSpecies.length, missingSpecies };
}

async function achievementLens(db: SQLiteDBConnection, scope: CompletionScope, field: FormPersonalBooleanField): Promise<Omit<CompletionLensResult, "lens">> {
  // Column name is interpolated (SQLite params can't bind identifiers) — safe
  // only because it's resolved through the fixed camelCase->snake_case map,
  // never taken directly from a caller-supplied string.
  if (!FORM_PERSONAL_BOOLEAN_FIELDS.includes(field)) throw new Error(`Unknown achievement field: ${field}`);
  const column = FORM_PERSONAL_FIELD_COLUMNS[field];

  const { where, params } = scopeClause(scope);
  const total = await countSpecies(db, where, params);
  const missingSpecies = await selectMissingSpecies(
    db,
    `SELECT s.slug, s.name, s.dex_number FROM species s
     WHERE ${where} AND NOT EXISTS (
       SELECT 1 FROM form f JOIN form_personal fp ON fp.form_slug = f.slug
       WHERE f.species_slug = s.slug AND fp.${column} = 1
     )`,
    params,
  );
  return { total, complete: total - missingSpecies.length, missingSpecies };
}

export async function getCompletionStatsSql(db: SQLiteDBConnection, scope: CompletionScope, lenses: CompletionLens[]): Promise<CompletionLensResult[]> {
  const results: CompletionLensResult[] = [];
  // Sequenced (not Promise.all) — these all share one SQLite connection.
  for (const lens of lenses) {
    const partial =
      lens.kind === "registered"
        ? await registeredLens(db, scope)
        : lens.kind === "formComplete"
          ? await formCompleteLens(db, scope)
          : lens.kind === "costumeComplete"
            ? await costumeCompleteLens(db, scope)
            : await achievementLens(db, scope, lens.field);
    results.push({ lens, ...partial });
  }
  return results;
}
