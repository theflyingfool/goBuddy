import { INDICATOR_OPTIONS, INDICATOR_LABELS } from "../data-entry/indicator-labels";
import { FORM_PERSONAL_BOOLEAN_FIELDS, type FormPersonalBooleanField } from "../../db/types";
import type { CompletionLens } from "../../data/repository";

/** Stable string key for a lens — used for Set membership and persisting the user's checkbox selection. */
export function lensKey(lens: CompletionLens): string {
  return lens.kind === "achievement" ? `achievement:${lens.field}` : lens.kind;
}

export function parseLensKey(key: string): CompletionLens | null {
  if (key === "registered" || key === "formComplete" || key === "costumeComplete") return { kind: key };
  if (key.startsWith("achievement:")) {
    const field = key.slice("achievement:".length) as FormPersonalBooleanField;
    if (FORM_PERSONAL_BOOLEAN_FIELDS.includes(field)) return { kind: "achievement", field };
  }
  return null;
}

export function lensLabel(lens: CompletionLens): string {
  switch (lens.kind) {
    case "registered":
      return "Registered";
    case "formComplete":
      return "Form-complete";
    case "costumeComplete":
      return "Costume-complete";
    case "achievement":
      return INDICATOR_LABELS[lens.field].full;
  }
}

/** The three whole-species lenses — always visible, not tucked into "More lenses". */
export const PRIMARY_LENSES: CompletionLens[] = [{ kind: "registered" }, { kind: "formComplete" }, { kind: "costumeComplete" }];

/** Every achievement-column lens (Shiny, Lucky, Shundo, ...) — collapsed under "More lenses" by default, same reasoning as the grid's "More filters": too many to show all at once. */
export const ACHIEVEMENT_LENSES: CompletionLens[] = INDICATOR_OPTIONS.map((field) => ({ kind: "achievement" as const, field }));

export const ALL_LENSES: CompletionLens[] = [...PRIMARY_LENSES, ...ACHIEVEMENT_LENSES];
