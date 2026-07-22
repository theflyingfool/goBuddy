export type Route =
  | { name: "data-entry-grid" }
  | { name: "data-entry-detail"; speciesSlug: string }
  | { name: "stats" }
  | { name: "search-tools" }
  | { name: "coverage-report" }
  | { name: "settings" }
  | { name: "help" }
  | { name: "achievements" }
  | { name: "xp-assistant" }
  | { name: "trainer" }
  | { name: "collection" }
  | { name: "log-catch" };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/data-entry";
  const detailMatch = path.match(/^\/data-entry\/species\/(.+)$/);
  if (detailMatch) return { name: "data-entry-detail", speciesSlug: decodeURIComponent(detailMatch[1]) };

  switch (path) {
    // "/bulk-edit" no longer has its own route — Bulk Edit was merged into
    // the Dex grid's select-mode (see species-grid.ts). Falls through to the
    // default grid route below rather than 404-ing for anyone with an old
    // bookmark/hash.
    case "/stats":
      return { name: "stats" };
    case "/search-tools":
      return { name: "search-tools" };
    case "/coverage-report":
      return { name: "coverage-report" };
    case "/settings":
      return { name: "settings" };
    case "/help":
      return { name: "help" };
    case "/achievements":
      return { name: "achievements" };
    case "/xp-assistant":
      return { name: "xp-assistant" };
    case "/trainer":
      return { name: "trainer" };
    case "/collection":
      return { name: "collection" };
    case "/log-catch":
      return { name: "log-catch" };
    case "/data-entry":
    default:
      return { name: "data-entry-grid" };
  }
}

export function navigate(path: string) {
  location.hash = path;
}

export function speciesDetailPath(speciesSlug: string): string {
  return `/data-entry/species/${encodeURIComponent(speciesSlug)}`;
}
