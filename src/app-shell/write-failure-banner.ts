// Persistent banner for a failed SQLite write-through (see
// src/data/sqlite-repository.ts's enqueueWrite) — previously only
// console.error'd, so a write could silently fail to persist while the UI
// (reading from the in-memory cache) looked fine. Mounted once at boot;
// shown/updated by report(), hidden again once a retry actually succeeds.

import { el } from "../ui/dom";

let bannerEl: HTMLElement | null = null;
let messageEl: HTMLElement | null = null;
let retryButton: HTMLButtonElement | null = null;

export function mountWriteFailureBanner(container: HTMLElement): void {
  messageEl = el("span", { class: "write-failure-message" });
  retryButton = el("button", { type: "button", class: "write-failure-retry" }, ["Retry"]) as HTMLButtonElement;
  bannerEl = el("div", { class: "write-failure-banner" }, [messageEl, retryButton]);
  container.append(bannerEl);
}

/** Shows (or updates) the banner for one failed write, wiring `retry` to the Retry button. Hides itself once `retry()` resolves. */
export function reportWriteFailure(message: string, retry: () => Promise<void>): void {
  if (!bannerEl || !messageEl || !retryButton) return;
  messageEl.textContent = `Couldn't save your last change: ${message}`;
  bannerEl.classList.add("visible");
  retryButton.disabled = false;
  retryButton.onclick = () => {
    retryButton!.disabled = true;
    retry()
      .then(() => bannerEl!.classList.remove("visible"))
      .catch((err) => reportWriteFailure(err instanceof Error ? err.message : String(err), retry));
  };
}
