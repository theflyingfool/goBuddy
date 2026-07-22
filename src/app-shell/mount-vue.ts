// Bridges Vue into the existing hash-router: main.ts's render() dispatches
// on route name to one render function per screen (vanilla ones each
// `clear(container)` and rebuild by hand). A migrated route calls
// mountVueRoute() instead — see docs/vue-migration-plan.md for the
// incremental, route-by-route migration this is the seam for.
//
// Vue apps don't get cleaned up by a plain clear(container): unlike the
// vanilla render functions, an unmounted-but-still-`createApp`'d instance
// leaks reactive effects and duplicate event listeners on the next
// navigation. Every route render must go through unmountCurrentVueRoute()
// first, whether or not the next route is itself a Vue one.
import { createApp, type App, type Component } from "vue";

let currentApp: App | null = null;

export function unmountCurrentVueRoute(): void {
  if (currentApp) {
    currentApp.unmount();
    currentApp = null;
  }
}

export function mountVueRoute(container: HTMLElement, component: Component, props: Record<string, unknown>): void {
  unmountCurrentVueRoute();
  container.replaceChildren();
  const app = createApp(component, props);
  app.mount(container);
  currentApp = app;
}
