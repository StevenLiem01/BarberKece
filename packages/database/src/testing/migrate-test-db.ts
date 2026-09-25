import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createSafeTestDatabaseContext } from "./test-database-guard.js";

/**
 * Runs Drizzle migrations strictly against the verified test database (barberkece_test).
 *
 * FAILS CLOSED:
 * - Requires explicit TEST_DATABASE_URL
 * - Validates host is local loopback
 * - Verifies connected database is strictly 'barberkece_test' before applying any migration
 * - Never touches DATABASE_URL or development/production databases
 */
export async function runTestDatabaseMigrations(): Promise<{
  migrationsFolder: string;
}> {
  const safeDb = await createSafeTestDatabaseContext();
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const migrationsFolder = resolve(currentDir, "../../migrations");

    await migrate(safeDb.db, { migrationsFolder });

    return { migrationsFolder };
  } finally {
    await safeDb.close();
  }
}
