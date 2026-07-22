import { readFileSync } from "node:fs";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version: string };

export default defineConfig({
  root: "src",
  publicDir: "../public",
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
