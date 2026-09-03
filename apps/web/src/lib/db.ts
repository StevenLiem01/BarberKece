import { parseEnv } from "@barberkece/config";
import { createDatabase, type DatabaseClient } from "@barberkece/database";

declare global {
  var __barberkece_db_client__: DatabaseClient | undefined;
}

let productionClient: DatabaseClient | undefined;

/**
 * Returns a DatabaseClient instance using canonical config.
 *
 * In production / serverless environments: returns one reusable module-level client per runtime instance.
 * In development: caches the client on globalThis to prevent PostgreSQL client exhaustion during Next.js HMR.
 */
export function getDatabaseClient(): DatabaseClient {
  const env = parseEnv(process.env);

  if (process.env.NODE_ENV === "production") {
    if (!productionClient) {
      productionClient = createDatabase(env.DATABASE_URL);
    }
    return productionClient;
  }

  if (!globalThis.__barberkece_db_client__) {
    globalThis.__barberkece_db_client__ = createDatabase(env.DATABASE_URL);
  }

  return globalThis.__barberkece_db_client__;
}
