// Shared helpers between SpeciesDetailPage.vue and BulkFormEditPanel.vue —
// both need the identical gender-collapsing form grouping and Mega-variant
// label formatting, so these live here rather than being duplicated (or one
// page importing from the other).
import type { Form, MegaVariantKind } from "../../db/types";
import type { SpeciesFilter } from "../../data/repository";

export const COLLAPSE_GENDER_FORMS_SETTING_KEY = "collapse_gender_forms";

// "Mega" for the single-variant case (null), "Mega X"/"Mega Y" for
// Charizard/Mewtwo-style dual variants, "Primal" as-is (that's the real
// in-game name — not "Mega Primal").
export function megaVariantLabel(variant: MegaVariantKind): string {
  return variant === null ? "Mega" : variant === "Primal" ? "Primal" : `Mega ${variant}`;
}

export interface FormGroup {
  key: string;
  label: string;
  forms: Form[];
}

// Used by both the species-detail page and the bulk-form-edit page, which
// need the identical gender-collapsing grouping (one checkbox per form/
// costume, gender variants merged) rather than reinventing it.
export function groupForms(forms: Form[], collapseGender: boolean): FormGroup[] {
  const groups = new Map<string, FormGroup>();
  for (const form of forms) {
    const groupKey = collapseGender ? `${form.formName}|${form.costumeName ?? ""}` : form.slug;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.forms.push(form);
    } else {
      const baseLabel = form.costumeName ?? form.formName;
      const label = collapseGender ? baseLabel : `${baseLabel} (${form.gender})`;
      groups.set(groupKey, { key: groupKey, label, forms: [form] });
    }
  }
  return [...groups.values()];
}

// Relocated verbatim from bulk-form-edit.ts (deleted, Task 7 — see
// docs/vue-migration-plan.md), which BulkFormEditPanel.vue now replaces.
// Exported for unit testing: whether a form-group tile should be kept under
// the Caught/Uncaught filter, evaluated per-form (never against
// species_personal.registered — see the comment where this is called for
// why that's the bug this guards against). "Caught" keeps a group with at
// least one caught form; "Uncaught" keeps a group with zero caught forms —
// the same "some form in the group" semantics used for the field-filter
// chips just below this call site.
export function matchesCaughtFilter(filterValue: NonNullable<SpeciesFilter["caught"]>, formsCaught: boolean[]): boolean {
  if (filterValue === "all") return true;
  const anyCaught = formsCaught.some(Boolean);
  return filterValue === "caught" ? anyCaught : !anyCaught;
}

