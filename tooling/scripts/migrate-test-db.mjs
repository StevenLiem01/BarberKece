import console from "node:console";
import process from "node:process";
import { runTestDatabaseMigrations } from "../../packages/database/dist/testing/index.js";

try {
  console.log("Starting guarded test database migration for barberkece_test...");
  const result = await runTestDatabaseMigrations();
  console.log(`Migrations successfully applied from: ${result.migrationsFolder}`);
  process.exit(0);
} catch (err) {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const sanitized = rawMsg.replace(/postgres:\/\/[^\s]*/gi, "[REDACTED]");
  console.error(`Migration failed: ${sanitized}`);
  process.exit(1);
}
