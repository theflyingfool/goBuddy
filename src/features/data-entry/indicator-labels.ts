import { FORM_PERSONAL_BOOLEAN_FIELDS, type FormPersonalBooleanField } from "../../db/types";

export const INDICATOR_LABELS: Record<FormPersonalBooleanField, { badge: string; full: string }> = {
  caught: { badge: "●", full: "Caught" },
  shiny: { badge: "✨", full: "Shiny" },
  floor: { badge: "0", full: "Floor IV" },
  fourStar: { badge: "★", full: "4★" },
  shundo: { badge: "💎", full: "Shundo" },
  lucky: { badge: "🍀", full: "Lucky" },
  luckyShiny: { badge: "🍀✨", full: "Lucky shiny" },
  luckyFloor: { badge: "🍀0", full: "Lucky floor IV" },
  luckyFourStar: { badge: "🍀★", full: "Lucky 4★" },
  luckyShundo: { badge: "🍀💎", full: "Lucky shundo" },
  shadow: { badge: "☾", full: "Shadow" },
  shadowShiny: { badge: "☾✨", full: "Shadow shiny" },
  shadowFloor: { badge: "☾0", full: "Shadow floor IV" },
  shadowFourStar: { badge: "☾★", full: "Shadow 4★" },
  shadowShundo: { badge: "☾💎", full: "Shadow shundo" },
  dynamax: { badge: "D", full: "Dynamax" },
  dynamaxFloor: { badge: "D0", full: "Dynamax floor IV" },
  dynamaxShiny: { badge: "D✨", full: "Dynamax shiny" },
  dynamaxFourStar: { badge: "D★", full: "Dynamax 4★" },
  dynamaxShundo: { badge: "D💎", full: "Dynamax shundo" },
  luckyDynamax: { badge: "🍀D", full: "Lucky Dynamax" },
  luckyDynamaxFloor: { badge: "🍀D0", full: "Lucky Dynamax floor IV" },
  luckyDynamaxShiny: { badge: "🍀D✨", full: "Lucky Dynamax shiny" },
  luckyDynamaxFourStar: { badge: "🍀D★", full: "Lucky Dynamax 4★" },
  luckyDynamaxShundo: { badge: "🍀D💎", full: "Lucky Dynamax shundo" },
};

// "caught" is communicated via grayscale-until-caught on the grid, not a
// badge, so it's excluded from the pickable indicator set in Settings.
export const INDICATOR_OPTIONS: FormPersonalBooleanField[] = FORM_PERSONAL_BOOLEAN_FIELDS.filter(
  (f) => f !== "caught",
);
