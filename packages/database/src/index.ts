export {
  createDatabase,
  type Database,
  type DatabaseClient,
} from "./client.js";
export * as schema from "./schema/index.js";
export { sql } from "drizzle-orm";
