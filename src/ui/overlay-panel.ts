// Shared backdrop + inert + focus-management behavior for any slide-in/pop-up
// panel (nav drawer's "More" flyout, the grid/bulk-edit filter sheet). Pulled
// out of main.ts's original nav-drawer-only setDrawerOpen so every overlay in
// the app gets the same accessibility handling instead of a copy each.
export interface OverlayPanel {
  open(): void;
  close(): void;
  toggle(): void;
  readonly isOpen: boolean;
}

// `getTrigger` is a lookup function rather than a fixed element: the trigger
// button (hamburger/More tab/filter icon) typically lives inside a header or
// tab bar that gets rebuilt from scratch on route changes, so a captured
// element reference would go stale. Querying fresh each call always finds
// whatever's currently live in the DOM.
export function createOverlayPanel(panelEl: HTMLElement, backdropEl: HTMLElement, getTrigger: () => HTMLElement | null, focusSelector = ".nav-item, button, input, [tabindex]"): OverlayPanel {
  let open = false;

  function setOpen(next: boolean) {
    const wasOpen = open;
    open = next;
    panelEl.classList.toggle("open", open);
    backdropEl.classList.toggle("open", open);
    getTrigger()?.setAttribute("aria-expanded", String(open));

    if (open) {
      panelEl.removeAttribute("inert");
      panelEl.querySelector<HTMLElement>(focusSelector)?.focus();
    } else {
      panelEl.setAttribute("inert", "");
      // Only steal focus back when we're actually closing something that was
      // open (Escape/backdrop/item click) — not on an unrelated re-render
      // that happens to call close() on an already-closed panel.
      if (wasOpen) getTrigger()?.focus();
    }
  }

  backdropEl.addEventListener("click", () => setOpen(false));

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    get isOpen() {
      return open;
    },
  };
}

/** Escape closes whichever of the given panels is currently open. */
export function bindEscapeToClose(...panels: OverlayPanel[]) {
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const panel of panels) {
      if (panel.isOpen) {
        panel.close();
        return;
      }
    }
  });
}
