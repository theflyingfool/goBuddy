import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/personal.ts",
  out: "./src/db/migrations",
});
