import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

if (!process.env["DATABASE_URL"]) {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const rootEnvPath = resolve(currentDir, "../../.env");

  if (existsSync(rootEnvPath)) {
    try {
      process.loadEnvFile(rootEnvPath);
    } catch {
      throw new Error(
        "Failed to load local root .env file. Verify file permissions and syntax.",
      );
    }
  }
}

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Create a local .env file with DATABASE_URL to run database tooling.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: databaseUrl,
  },
});
