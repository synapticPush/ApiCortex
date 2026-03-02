import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../.env" });

if (!process.env.DATABASE) {
  throw new Error("DATABASE is not set in .env");
}

export default defineConfig({
  out: "./drizzle/core",
  schema: "./src/core/schema.ts",
  tablesFilter: [
    "users",
    "organizations",
    "memberships",
    "apis",
    "endpoints",
    "openapi_specs",
    "contracts",
    "feature_flags",
    "jobs",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE,
  },
  verbose: true,
  strict: true,
});
