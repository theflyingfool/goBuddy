import { INDICATOR_OPTIONS, INDICATOR_LABELS } from "../data-entry/indicator-labels";
import { FORM_PERSONAL_BOOLEAN_FIELDS, type FormPersonalBooleanField } from "../../db/types";
import type { CompletionLens } from "../../data/repository";

/** Stable string key for a lens — used for Set membership and persisting the user's checkbox selection. */
export function lensKey(lens: CompletionLens): string {
  return lens.kind === "achievement" ? `achievement:${lens.field}` : lens.kind;
}

export function parseLensKey(key: string): CompletionLens | null {
  if (key === "registered" || key === "formComplete" || key === "costumeComplete" || key === "gigantamaxComplete" || key === "megaComplete" || key === "megaShinyComplete") return { kind: key };
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
    case "gigantamaxComplete":
      return "G-max-complete";
    case "megaComplete":
      return "Mega-complete";
    case "megaShinyComplete":
      return "Shiny mega-complete";
    case "achievement":
      return INDICATOR_LABELS[lens.field].full;
  }
}

/** The three whole-species lenses — always visible, not tucked into "More lenses". */
export const PRIMARY_LENSES: CompletionLens[] = [{ kind: "registered" }, { kind: "formComplete" }, { kind: "costumeComplete" }];

/** Every achievement-column lens (Shiny, Lucky, Shundo, ...) — collapsed under "More lenses" by default, same reasoning as the grid's "More filters": too many to show all at once. */
export const ACHIEVEMENT_LENSES: CompletionLens[] = INDICATOR_OPTIONS.map((field) => ({ kind: "achievement" as const, field }));

/** Mega lenses live in "More lenses" too, same denominator-only-counts-eligible-species shape as costumeComplete but for a much smaller slice of the dex (~50 species) — not worth a permanent KPI-row slot. */
export const MEGA_LENSES: CompletionLens[] = [{ kind: "megaComplete" }, { kind: "megaShinyComplete" }];

/** Split out of Form-complete (D2) — Gigantamax forms no longer count toward it, own lens instead, same "More lenses" placement as Mega (~32 species, too small for the KPI row). */
export const GIGANTAMAX_LENSES: CompletionLens[] = [{ kind: "gigantamaxComplete" }];

export const ALL_LENSES: CompletionLens[] = [...PRIMARY_LENSES, ...ACHIEVEMENT_LENSES, ...MEGA_LENSES, ...GIGANTAMAX_LENSES];
