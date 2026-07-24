// Shared helpers between SpeciesDetailPage.vue and bulk-form-edit.ts — both
// need the identical gender-collapsing form grouping and Mega-variant label
// formatting, so these live here rather than being duplicated (or one page
// importing from the other).
import type { Form, MegaVariantKind } from "../../db/types";

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

