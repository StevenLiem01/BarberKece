import console from "node:console";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createDatabase, sql } from "./index.js";

if (!process.env["DATABASE_URL"]) {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    resolve(process.cwd(), ".env"),
    resolve(currentDir, "../../../.env"),
    resolve(currentDir, "../../.env"),
  ];

  for (const envPath of candidatePaths) {
    if (existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
        if (process.env["DATABASE_URL"]) {
          break;
        }
      } catch {
        console.error(
          "ERROR: Failed to load local root .env file. Verify file permissions and syntax.",
        );
        process.exit(1);
      }
    }
  }
}

if (process.env["NODE_ENV"] === "production") {
  console.error("SAFETY ABORT: db:seed must never run in production.");
  process.exit(1);
}

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  console.error(
    "ERROR: DATABASE_URL is not set. Ensure root .env exists or DATABASE_URL is in your environment.",
  );
  process.exit(1);
}

let client: ReturnType<typeof createDatabase> | undefined;

try {
  client = createDatabase(databaseUrl);

  const identityRes = await client.db.execute(
    sql`SELECT current_user, current_database()`,
  );
  const row = identityRes[0];
  const currentUser = row?.["current_user"];
  const currentDatabase = row?.["current_database"];

  if (currentDatabase !== "barberkece_dev") {
    console.error(
      `SAFETY ABORT: Target database is '${String(currentDatabase)}', expected 'barberkece_dev'.`,
    );
    await client.close();
    process.exit(1);
  }

  if (currentUser !== "barberkece_dev") {
    console.error(
      `SAFETY ABORT: Target user is '${String(currentUser)}', expected 'barberkece_dev'.`,
    );
    await client.close();
    process.exit(1);
  }

  console.log("Database seed check: PASSED");
  console.log(`- current_user: ${String(currentUser)}`);
  console.log(`- current_database: ${String(currentDatabase)}`);
  console.log("- M0: Seed workflow ready. Zero initial records required.");

  await client.close();
  console.log("- connection closed cleanly");
} catch (err) {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const sanitizedMessage = rawMessage.replace(
    /postgresql?:\/\/[^\s]*/gi,
    "[REDACTED]",
  );
  console.error(`Database seeding FAILED: ${sanitizedMessage}`);

  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore close error during failure handling
    }
  }

  process.exit(1);
}
