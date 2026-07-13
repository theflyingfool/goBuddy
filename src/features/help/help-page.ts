import { clear, el } from "../../ui/dom";
import { INDICATOR_LABELS } from "../data-entry/indicator-labels";
import type { FormPersonalBooleanField } from "../../db/types";

function helpRow(badge: string, label: string, description: string): HTMLElement {
  return el("div", { class: "help-row" }, [
    el("span", { class: "help-badge" }, [badge]),
    el("span", { class: "help-row-body" }, [el("strong", {}, [label]), ` — ${description}`]),
  ]);
}

// A representative slice of INDICATOR_LABELS, not every combo (there are 30)
// — the combos all follow the same "prefix stacks with the base meaning"
// rule explained above the list, so listing every lucky/shadow/dynamax×
// floor/shundo/4★ permutation would just repeat that rule 30 times instead
// of explaining it once.
const REPRESENTATIVE_BADGES: { field: FormPersonalBooleanField; description: string }[] = [
  { field: "caught", description: "you own this form at all — every other badge implies this one." },
  { field: "shiny", description: "caught a shiny individual of this form." },
  { field: "floor", description: "caught one at the worst possible IVs for a normal catch (see the glossary below)." },
  { field: "fourStar", description: "caught one rated 4-star on appraisal." },
  { field: "shundo", description: "caught a shiny that's also 100% IV — see the glossary below." },
  { field: "lucky", description: "traded this form into a Lucky Pokémon." },
  { field: "shadow", description: "caught/obtained this form as Shadow." },
  { field: "dynamax", description: "this form has Dynamaxed at least once." },
  { field: "luckyShundo", description: "a Lucky individual that's also a Shundo — every prefix/base combo stacks the same way." },
  { field: "shadowFloor", description: "a Shadow individual at Shadow's own IV floor (usually 0/0/0, occasionally raised for some raid-sourced Shadows)." },
];

export function renderHelpPage(container: HTMLElement) {
  clear(container);

  const heading = el("h2", {}, ["Help"]);

  const badgeFieldset = el("fieldset", {}, [el("legend", {}, ["Badge glyphs"])]);
  badgeFieldset.append(
    el("p", { class: "help-intro" }, [
      "Badges combine: a prefix (🍀 Lucky / ☾ Shadow / D Dynamaxed) stacks with a base achievement (✨ Shiny, 0 Floor IV, ★ 4★, 💎 Shundo) to mean \"this Lucky/Shadow/Dynamaxed individual also hit that achievement.\" A few examples:",
    ]),
  );
  for (const { field, description } of REPRESENTATIVE_BADGES) {
    const { badge, full } = INDICATOR_LABELS[field];
    badgeFieldset.append(helpRow(badge, full, description));
  }

  const lensFieldset = el("fieldset", {}, [el("legend", {}, ["Stats lenses"])]);
  lensFieldset.append(
    helpRow("", "Registered", "you've caught the species at all — one catch of any form counts."),
    helpRow("", "Form-complete", "every non-costume, non-Gigantamax form of a species is caught. Regional-exclusive forms count unless you turn that off in Settings."),
    helpRow("", "Costume-complete", "every costume form of a species is caught. Only species that have ever had a costume count toward the total — species with no costume don't drag the percentage down."),
    helpRow("", "Gigantamax-complete", "every Gigantamax form of a species is caught. Same denominator rule as Costume-complete: only Gigantamax-capable species count."),
    helpRow("", "Mega-complete / Mega-shiny-complete", "every Mega/Primal variant of a species has been Mega Evolved (or Shiny Mega Evolved) at least once. Charizard needs both X and Y, not just one."),
  );

  const glossaryFieldset = el("fieldset", {}, [el("legend", {}, ["Floor / Shundo glossary"])]);
  glossaryFieldset.append(
    helpRow("0", "Floor IV", "the lowest possible IVs for that catch type — 0/0/0 for a normal or Shadow catch, 12/12/12 for a Lucky catch (Lucky Pokémon are guaranteed at least 12 in every stat)."),
    helpRow("💎", "Shundo", "shiny + 100% IV ('hundo') on the same individual. Stored as its own fact, not inferred from the shiny and floor/4★ flags separately — catching a shiny and a hundo doesn't imply they were the same Pokémon."),
    helpRow("★", "4★", "a 4-star Team Leader appraisal — this app's shorthand for a Pokémon whose IVs the in-game appraisal rates at the top tier."),
  );

  const chipFieldset = el("fieldset", {}, [el("legend", {}, ["Filter chips"])]);
  chipFieldset.append(
    el("p", { class: "help-intro" }, [
      "Every filter chip on the Dex grid is tri-state — tap to cycle: off → ",
      el("strong", {}, ["included ✓"]),
      " → ",
      el("strong", {}, ["excluded ✕"]),
      " → off. \"Included\" shows only species/forms matching that filter; \"excluded\" hides them.",
    ]),
  );

  const searchFieldset = el("fieldset", {}, [el("legend", {}, ["Search box keywords"])]);
  searchFieldset.append(
    el("p", { class: "help-intro" }, [
      "Beyond a species name or dex number, typing one of these words alone into a search box filters by it instead — put ",
      el("strong", {}, ["!"]),
      " in front to mean \"not\" (e.g. ",
      el("strong", {}, ["!costume"]),
      " for everything without one). Works in the Dex grid, Bulk Edit, and species-detail's own form search.",
    ]),
    helpRow("", "costume", "has this species/form ever had a costume."),
    helpRow("", "legendary / mythical / ultrabeast", "matches the species' rarity classification — same as the L/M/UB chips, just reachable from the search box too."),
  );

  container.append(heading, badgeFieldset, lensFieldset, glossaryFieldset, chipFieldset, searchFieldset);
}
