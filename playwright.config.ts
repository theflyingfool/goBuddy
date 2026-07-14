import { defineConfig, devices } from "@playwright/test";

// Port deliberately distinct from `npm run dev`'s default (5173) so this
// suite never collides with a dev server someone already has running.
const PORT = 5183;

export default defineConfig({
  testDir: "./e2e",
  // Only 3 tests, each paying the same cold-boot cost (~8,156-row reference
  // sync + jeep-sqlite/sql.js WASM load on a fresh IndexedDB, plus Vite's
  // on-demand module transform on an unwarmed dev server) — running them in
  // parallel just makes every one of them slower by contending for the same
  // single dev-server process. Not worth it for a suite this small.
  workers: 1,
  expect: {
    timeout: 20_000,
  },
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  // This is an Android-only Capacitor app — "web" is only a dev convenience
  // (`npm run dev`), never a shipped target — so a cross-browser matrix would
  // add CI time for no real coverage value. Chromium only.
  // --no-sandbox/--disable-dev-shm-usage: standard flags for running
  // Chromium inside a container (CI runners, sandboxed dev environments) —
  // without them, Chromium's network service can spuriously fail every
  // request with ERR_NETWORK_CHANGED.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--no-sandbox", "--disable-dev-shm-usage"] } },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
