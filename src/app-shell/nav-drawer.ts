import { clear, el } from "../ui/dom";
import type { Route } from "./router";
import { navigate } from "./router";

interface NavItem {
  label: string;
  path: string;
  routeName: Route["name"];
  muted?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Pokedex", path: "/data-entry", routeName: "data-entry-grid" },
  { label: "Stats", path: "/stats", routeName: "stats" },
  { label: "Search Tools", path: "/search-tools", routeName: "search-tools" },
  { label: "Coverage Report", path: "/coverage-report", routeName: "coverage-report" },
  { label: "Settings", path: "/settings", routeName: "settings" },
  { label: "Achievements", path: "/achievements", routeName: "achievements", muted: true },
  { label: "XP Assistant", path: "/xp-assistant", routeName: "xp-assistant", muted: true },
];

export function renderNavDrawer(container: HTMLElement, currentRouteName: Route["name"], onNavigate: () => void) {
  clear(container);

  const list = el("ul", { class: "nav-list" });
  for (const item of NAV_ITEMS) {
    const isCurrent =
      item.routeName === currentRouteName ||
      (item.routeName === "data-entry-grid" && currentRouteName === "data-entry-detail");
    const button = el(
      "button",
      {
        type: "button",
        class: ["nav-item", item.muted ? "nav-item-muted" : "", isCurrent ? "nav-item-current" : ""]
          .filter(Boolean)
          .join(" "),
      },
      [item.label],
    );
    button.addEventListener("click", () => {
      navigate(item.path);
      onNavigate();
    });
    list.append(el("li", {}, [button]));
  }

  container.append(el("h2", { class: "nav-title" }, ["PoGo Buddy"]), list);
}
