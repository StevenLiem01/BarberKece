import console from "node:console";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createDatabase, sql } from "../../packages/database/dist/index.js";

if (!process.env["DATABASE_URL"]) {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const rootEnvPath = resolve(currentDir, "../../.env");

  if (existsSync(rootEnvPath)) {
    try {
      process.loadEnvFile(rootEnvPath);
    } catch {
      console.error(
        "ERROR: Failed to load local root .env file. Verify file permissions and syntax.",
      );
      process.exit(1);
    }
  }
}

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  console.error(
    "ERROR: DATABASE_URL is not set. Ensure root .env exists or DATABASE_URL is in your environment.",
  );
  process.exit(1);
}

let client;

try {
  client = createDatabase(databaseUrl);

  // Step 2: Verify identity (must be strictly barberkece_dev)
  const identityRes = await client.db.execute(
    sql`SELECT current_user, current_database()`,
  );
  const row = identityRes[0];
  const currentUser = row?.current_user;
  const currentDatabase = row?.current_database;

  if (currentDatabase !== "barberkece_dev") {
    console.error(
      `SAFETY ABORT: Target database is '${currentDatabase}', expected 'barberkece_dev'.`,
    );
    await client.close();
    process.exit(1);
  }

  if (currentUser !== "barberkece_dev") {
    console.error(
      `SAFETY ABORT: Target user is '${currentUser}', expected 'barberkece_dev'.`,
    );
    await client.close();
    process.exit(1);
  }

  // Step 3: Harmless read-only ping
  const pingRes = await client.db.execute(sql`SELECT 1 AS ping`);
  const ping = pingRes[0]?.ping;

  if (ping !== 1) {
    console.error(`SAFETY ABORT: SELECT 1 returned unexpected result.`);
    await client.close();
    process.exit(1);
  }

  // Step 4: Clean connection shutdown
  await client.close();

  console.log("Database connectivity check: PASSED");
  console.log(`- current_user: ${currentUser}`);
  console.log(`- current_database: ${currentDatabase}`);
  console.log(`- SELECT 1 ping: ${ping}`);
  console.log("- connection closed cleanly");
} catch (err) {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const sanitizedMessage = rawMessage.replace(
    /postgresql?:\/\/[^\s]*/gi,
    "[REDACTED]",
  );
  console.error(`Database connectivity check FAILED: ${sanitizedMessage}`);

  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore close error during failure
    }
  }

  process.exit(1);
}
