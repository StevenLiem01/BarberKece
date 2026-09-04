export {
  createDatabase,
  type Database,
  type DatabaseClient,
  type Transaction,
  type DbOrTx,
} from "./client.js";
export * as schema from "./schema/index.js";
export * as repositories from "./repositories/index.js";
export { sql } from "drizzle-orm";

/**
 * Deterministic, narrowly-scoped 64-bit advisory lock key for initial admin bootstrap serialization.
 */
export const BOOTSTRAP_ADMIN_ADVISORY_LOCK_ID = 84729103984719283n;
