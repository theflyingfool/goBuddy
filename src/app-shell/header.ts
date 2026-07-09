import type { Repository } from "../data/repository";
import { clear, el } from "../ui/dom";

export type HeaderMode =
  | { kind: "filter"; value: string; onChange: (value: string) => void }
  | { kind: "jump"; repo: Repository; onSelect: (speciesSlug: string) => void }
  | { kind: "none" };

export function renderHeader(container: HTMLElement, mode: HeaderMode, onHamburgerClick: () => void) {
  clear(container);

  const hamburger = el("button", { type: "button", class: "hamburger-button", "aria-label": "Menu" }, ["☰"]);
  hamburger.addEventListener("click", onHamburgerClick);

  const searchWrap = el("div", { class: "header-search" });

  if (mode.kind === "filter") {
    const input = el("input", {
      type: "search",
      placeholder: "Filter by name or #",
      value: mode.value,
      class: "search-input",
    }) as HTMLInputElement;
    input.addEventListener("input", () => mode.onChange(input.value));
    searchWrap.append(input);
  } else if (mode.kind === "jump") {
    const input = el("input", {
      type: "search",
      placeholder: "Jump to a Pokémon…",
      class: "search-input",
    }) as HTMLInputElement;
    const results = el("ul", { class: "jump-results" });

    input.addEventListener("input", () => {
      clear(results);
      const matches = mode.repo.searchSpecies(input.value);
      for (const species of matches) {
        const button = el("button", { type: "button", class: "jump-result" }, [
          el("span", { class: "dex-num" }, [`#${species.dexNumber}`]),
          ` ${species.name}`,
        ]);
        button.addEventListener("click", () => {
          input.value = "";
          clear(results);
          mode.onSelect(species.slug);
        });
        results.append(el("li", {}, [button]));
      }
    });

    searchWrap.append(input, results);
  }

  container.append(hamburger, searchWrap);
}
