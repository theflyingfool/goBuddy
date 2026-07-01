import type { FormPersonal, SpeciesPersonal } from "../../db/types";

type FormField = keyof Omit<FormPersonal, "formSlug" | "bestShiny" | "bestNonShiny" | "bestLucky">;

export const FORM_FIELD_GROUPS: { title: string; fields: { field: FormField; label: string }[] }[] = [
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
    fields: [
      { field: "dynamax", label: "Dynamax" },
      { field: "dynamaxFloor", label: "Dynamax floor IV" },
      { field: "dynamaxShiny", label: "Dynamax shiny" },
      { field: "dynamaxFourStar", label: "Dynamax 4★" },
      { field: "dynamaxShundo", label: "Dynamax shundo" },
    ],
  },
  {
    title: "Lucky Dynamax",
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
