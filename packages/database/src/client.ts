import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = ReturnType<typeof createDatabase>["db"];
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;

export type DatabaseClient = {
  db: ReturnType<typeof drizzle<typeof schema>>;
  /**
   * Closes the underlying PostgreSQL connection pool.
   * Call this when the process is shutting down.
   */
  close: () => Promise<void>;
};

/**
 * Creates a Drizzle database instance from an explicit connection URL.
 *
 * Does NOT read process.env at import time.
 * Callers are responsible for providing the URL and calling close() on shutdown.
 */
export function createDatabase(databaseUrl: string): DatabaseClient {
  const sql = postgres(databaseUrl);
  const db = drizzle(sql, { schema });

  return {
    db,
    close: async () => {
      await sql.end();
    },
  };
}
