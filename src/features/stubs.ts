import { clear, el } from "../ui/dom";

function renderStub(container: HTMLElement, title: string, message: string) {
  clear(container);
  container.append(el("h2", {}, [title]), el("p", { class: "stub-message" }, [message]));
}

export function renderStatsPage(container: HTMLElement) {
  renderStub(container, "Stats", "Completion/progress stats aren't built yet — coming in a future update.");
}

export function renderSearchToolsPage(container: HTMLElement) {
  renderStub(
    container,
    "Search Tools",
    "The search-string builder and auto-declutter engine will live here together — not built yet.",
  );
}

export function renderAchievementsPage(container: HTMLElement) {
  renderStub(container, "Achievements", "Planned for a future phase of PoGo Buddy, beyond dex-tracking.");
}

export function renderXpAssistantPage(container: HTMLElement) {
  renderStub(container, "XP Assistant", "Planned for a future phase of PoGo Buddy, beyond dex-tracking.");
}
