import type { Form, FormPersonal, SpeciesPersonal } from "../../db/types";

type FormField = keyof Omit<FormPersonal, "formSlug" | "bestShiny" | "bestNonShiny" | "bestLucky">;

export const FORM_FIELD_GROUPS: { title: string; fields: { field: FormField; label: string }[]; availableWhen?: (form: Form) => boolean }[] = [
  {
    title: "Standard",
    fields: [
      { field: "caught", label: "Caught" },
      { field: "shiny", label: "Shiny" },
      { field: "floor", label: "Floor IV" },
      { field: "fourStar", label: "4★" },
      { field: "shundo", label: "Shundo" },
    ],
  },
  {
    // No corresponding reference-availability flag — Lucky comes from
    // trading, a universal mechanic not gated per-form in the schema.
    title: "Lucky",
    fields: [
      { field: "lucky", label: "Lucky" },
      { field: "luckyShiny", label: "Lucky shiny" },
      { field: "luckyFloor", label: "Lucky floor IV" },
      { field: "luckyFourStar", label: "Lucky 4★" },
      { field: "luckyShundo", label: "Lucky shundo" },
    ],
  },
  {
    title: "Shadow",
    availableWhen: (form) => form.shadowAvailable,
    fields: [
      { field: "shadow", label: "Shadow" },
      { field: "shadowShiny", label: "Shadow shiny" },
      { field: "shadowFloor", label: "Shadow floor IV" },
      { field: "shadowFourStar", label: "Shadow 4★" },
      { field: "shadowShundo", label: "Shadow shundo" },
    ],
  },
  {
    title: "Dynamax",
    availableWhen: (form) => form.dynamaxAvailable,
    fields: [
      { field: "dynamax", label: "Dynamax" },
      { field: "dynamaxFloor", label: "Dynamax floor IV" },
      { field: "dynamaxShiny", label: "Dynamax shiny" },
      { field: "dynamaxFourStar", label: "Dynamax 4★" },
      { field: "dynamaxShundo", label: "Dynamax shundo" },
    ],
  },
  {
    // Lucky Dynamax is a sub-variant of Dynamax, not an independently
    // gated reference flag — same availableWhen as the Dynamax group above.
    title: "Lucky Dynamax",
    availableWhen: (form) => form.dynamaxAvailable,
    fields: [
      { field: "luckyDynamax", label: "Lucky Dynamax" },
      { field: "luckyDynamaxFloor", label: "Lucky Dynamax floor IV" },
      { field: "luckyDynamaxShiny", label: "Lucky Dynamax shiny" },
      { field: "luckyDynamaxFourStar", label: "Lucky Dynamax 4★" },
      { field: "luckyDynamaxShundo", label: "Lucky Dynamax shundo" },
    ],
  },
];

type SpeciesField = keyof Omit<SpeciesPersonal, "speciesSlug">;

export const SPECIES_FIELDS: { field: SpeciesField; label: string }[] = [
  { field: "registered", label: "Registered" },
  { field: "xxl", label: "XXL" },
  { field: "xxs", label: "XXS" },
  { field: "purified", label: "Purified" },
];
