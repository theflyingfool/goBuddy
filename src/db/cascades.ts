// Forward-only cascade rules: checking a "higher" achievement should also
// check its logical prerequisites, so the user doesn't need to tap every
// implied box by hand for one real-world catch (e.g. a shundo catch already
// implies caught + shiny + fourStar). Unchecking never cascades — that was
// explicitly decided against, since un-ticking one box shouldn't silently
// erase other independently-verified facts.
//
// Built programmatically from FORM_FIELD_GROUPS (src/features/data-entry/field-groups.ts)
// rather than hand-typed per field, since the same shiny/floor/fourStar/shundo
// -> base pattern repeats identically across all five sections (Standard,
// Lucky, Shadow, Dynamax, Lucky Dynamax) — encoding it once here keeps the
// two in sync automatically if a section's fields ever change.

import { FORM_FIELD_GROUPS } from "../features/data-entry/field-groups";
import type { FormPersonalBooleanField } from "./types";

function buildFormFieldCascades(): Partial<Record<FormPersonalBooleanField, FormPersonalBooleanField[]>> {
  const cascades: Partial<Record<FormPersonalBooleanField, FormPersonalBooleanField[]>> = {};

  for (const group of FORM_FIELD_GROUPS) {
    const fields = group.fields.map((f) => f.field);
    // The base field is always listed first per section (caught/lucky/shadow/
    // dynamax/luckyDynamax); the other four vary in listed order between
    // sections (e.g. Dynamax lists floor before shiny, unlike Standard/Lucky/
    // Shadow), so match the shiny/floor/fourStar/shundo-equivalents by name
    // suffix rather than assuming a fixed position.
    const base = fields[0];
    const shiny = fields.find((f) => f.endsWith("Shiny"))!;
    const floor = fields.find((f) => f.endsWith("Floor"))!;
    const fourStar = fields.find((f) => f.endsWith("FourStar"))!;
    const shundo = fields.find((f) => f.endsWith("Shundo"))!;

    for (const field of [shiny, floor, fourStar, shundo]) {
      cascades[field] = [...(cascades[field] ?? []), base];
    }
    // Shundo (shiny + perfect IV) additionally implies both shiny and fourStar
    // for that same section — independently stored facts, but a shundo catch
    // is definitionally also a shiny and a 4-star, so both get set alongside it.
    cascades[shundo] = [...(cascades[shundo] ?? []), shiny, fourStar];
  }

  return cascades;
}

/** Direct (one-level) cascade targets per field. Resolve transitively via resolveFormFieldCascade. */
export const FORM_FIELD_CASCADES: Partial<Record<FormPersonalBooleanField, FormPersonalBooleanField[]>> = buildFormFieldCascades();

/**
 * Resolves the full transitive set of fields implied by setting `field` to
 * true (not including `field` itself). Transitive because shundo cascades to
 * 3 other fields at once (shiny, fourStar, base), and shiny/fourStar each
 * further cascade to base.
 */
export function resolveFormFieldCascade(field: FormPersonalBooleanField): FormPersonalBooleanField[] {
  const resolved = new Set<FormPersonalBooleanField>();
  const queue = [...(FORM_FIELD_CASCADES[field] ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (resolved.has(next)) continue;
    resolved.add(next);
    for (const implied of FORM_FIELD_CASCADES[next] ?? []) {
      if (!resolved.has(implied)) queue.push(implied);
    }
  }
  return [...resolved];
}
