export type Route =
  | { name: "data-entry-grid" }
  | { name: "data-entry-detail"; speciesSlug: string }
  | { name: "bulk-form-edit" }
  | { name: "stats" }
  | { name: "search-tools" }
  | { name: "coverage-report" }
  | { name: "settings" }
  | { name: "achievements" }
  | { name: "xp-assistant" };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/data-entry";
  const detailMatch = path.match(/^\/data-entry\/species\/(.+)$/);
  if (detailMatch) return { name: "data-entry-detail", speciesSlug: decodeURIComponent(detailMatch[1]) };

  switch (path) {
    case "/bulk-edit":
      return { name: "bulk-form-edit" };
    case "/stats":
      return { name: "stats" };
    case "/search-tools":
      return { name: "search-tools" };
    case "/coverage-report":
      return { name: "coverage-report" };
    case "/settings":
      return { name: "settings" };
    case "/achievements":
      return { name: "achievements" };
    case "/xp-assistant":
      return { name: "xp-assistant" };
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
