import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Non-type-checked rules only (no parserOptions.project) — deliberately, so
// the linter covers every .ts file including root-level configs
// (eslint.config.js, vite.config.ts) without tsconfig-inclusion gymnastics.
// The type-checked configs (recommendedTypeChecked) surface real issues
// (unawaited promises, `any` from untyped SQL rows) that would need a
// deliberate adoption pass, not smuggled in here.
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "android/**",
      "node_modules/**",
      "scripts/ingest/.cache/**",
      "data-authoring/**",
      "*.sqlite",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off", // already enforced by tsconfig's noUnusedLocals/noUnusedParameters
      "prefer-const": "error",
    },
  },
);
