// Manual light/dark override, layered on top of the `prefers-color-scheme`
// default already wired into style.css's token blocks — "system" just means
// "don't stamp data-theme, let the media query decide."

import type { Repository } from "../data/repository";

const THEME_SETTING_KEY = "theme_override";

export type ThemePreference = "system" | "light" | "dark";

export function getThemePreference(repo: Repository): ThemePreference {
  const raw = repo.getAppSetting(THEME_SETTING_KEY);
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function setThemePreference(repo: Repository, value: ThemePreference): void {
  repo.setAppSetting(THEME_SETTING_KEY, value);
  applyTheme(value);
}

export function applyTheme(value: ThemePreference): void {
  if (value === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
}
