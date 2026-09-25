import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { sql, type SQLWrapper } from "drizzle-orm";
import { createDatabase, DatabaseClient, Database } from "../client.js";

/**
 * Custom error thrown whenever a database safety invariant is violated.
 */
export class TestDatabaseSafetyError extends Error {
  constructor(message: string) {
    super(`[TEST DATABASE SAFETY VIOLATION] ${message}`);
    this.name = "TestDatabaseSafetyError";
  }
}

export interface ValidatedTestDbUrl {
  database: string;
  host: string;
  port: number;
  sanitizedUrl: string;
}

export interface ServerIdentityCheckResult {
  currentDatabase: string;
  serverAddr: string | null;
  serverPort: number | null;
  ping: number;
}

/**
 * Sanitizes a database connection URL by redacting credentials.
 */
export function redactConnectionUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.password) {
      url.password = "***";
    }
    if (url.username) {
      url.username = "***";
    }
    return url.toString();
  } catch {
    return "[MALFORMED_URL_REDACTED]";
  }
}

/**
 * Checks if a hostname or IP address is a local loopback address.
 */
export function isLocalHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== "string") {
    return false;
  }
  const normalized = hostname.toLowerCase().trim();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  );
}

/**
 * Validates that TEST_DATABASE_URL is set, well-formed, points to a local host,
 * and targets strictly 'barberkece_test'.
 *
 * FAILS CLOSED: Never falls back to DATABASE_URL or development databases.
 */
export function validateTestDatabaseUrl(rawUrl?: string): ValidatedTestDbUrl {
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.trim() === "") {
    throw new TestDatabaseSafetyError(
      "TEST_DATABASE_URL is not set. Database integration tests require an explicit TEST_DATABASE_URL pointing strictly to 'barberkece_test'. Fallback to DATABASE_URL or development/production databases is strictly forbidden.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new TestDatabaseSafetyError("TEST_DATABASE_URL is malformed.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new TestDatabaseSafetyError(
      `TEST_DATABASE_URL protocol must be 'postgres:' or 'postgresql:', received '${parsed.protocol}'.`,
    );
  }

  if (!isLocalHost(parsed.hostname)) {
    throw new TestDatabaseSafetyError(
      `TEST_DATABASE_URL host '${parsed.hostname}' is not a local loopback address (localhost, 127.0.0.1, ::1). Remote or non-local hosts are strictly forbidden for testing.`,
    );
  }

  // Extract database name from pathname: "/barberkece_test" -> "barberkece_test"
  const dbName = parsed.pathname.replace(/^\/+/, "").split("/")[0]?.trim();
  if (dbName !== "barberkece_test") {
    throw new TestDatabaseSafetyError(
      `TEST_DATABASE_URL target database is '${dbName || "(empty)"}', expected strictly 'barberkece_test'. Connecting to '${dbName || "unnamed"}' is strictly forbidden for testing.`,
    );
  }

  const port = parsed.port ? parseInt(parsed.port, 10) : 5432;

  return {
    database: dbName,
    host: parsed.hostname,
    port,
    sanitizedUrl: redactConnectionUrl(rawUrl),
  };
}

/**
 * Verifies that the connected database is strictly 'barberkece_test' on a local server.
 * Must be executed before any migration, test setup, or mutation.
 */
export async function verifyConnectedServer(db: {
  execute: (query: SQLWrapper | string) => Promise<unknown>;
}): Promise<ServerIdentityCheckResult> {
  const identityQuery = sql`
    SELECT current_database() AS current_database,
           inet_server_addr()::text AS server_addr,
           inet_server_port() AS server_port
  `;

  let rows: Array<{
    current_database?: string;
    server_addr?: string | null;
    server_port?: number | null;
  }>;

  try {
    rows = (await db.execute(identityQuery)) as typeof rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new TestDatabaseSafetyError(
      `Failed to execute identity verification query: ${msg.replace(/postgres:\/\/[^\s]*/gi, "[REDACTED]")}`,
    );
  }

  const identityRow = rows?.[0];
  if (!identityRow) {
    throw new TestDatabaseSafetyError(
      "Failed to read database server identity metadata (empty result).",
    );
  }

  const currentDatabase = identityRow.current_database;
  if (currentDatabase !== "barberkece_test") {
    throw new TestDatabaseSafetyError(
      `SAFETY ABORT: Connected database is '${currentDatabase}', expected strictly 'barberkece_test'. Immediate termination to prevent data corruption.`,
    );
  }

  const serverAddr = identityRow.server_addr;
  if (
    serverAddr !== null &&
    serverAddr !== undefined &&
    !isLocalHost(serverAddr)
  ) {
    throw new TestDatabaseSafetyError(
      `SAFETY ABORT: Connected server IP address '${serverAddr}' is not a local loopback address. Connection must be to local PostgreSQL instance.`,
    );
  }

  // Health ping
  const pingQuery = sql`SELECT 1 AS ping`;
  let pingRows: Array<{ ping?: number | string }>;
  try {
    pingRows = (await db.execute(pingQuery)) as typeof pingRows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new TestDatabaseSafetyError(`Health check query failed: ${msg}`);
  }

  const pingRow = pingRows?.[0];
  if (!pingRow || Number(pingRow.ping) !== 1) {
    throw new TestDatabaseSafetyError(
      "SAFETY ABORT: Health check query (SELECT 1) failed on test database.",
    );
  }

  return {
    currentDatabase,
    serverAddr: serverAddr ?? null,
    serverPort: identityRow.server_port ?? null,
    ping: Number(pingRow.ping),
  };
}

export interface SafeTestDatabaseContext {
  dbClient: DatabaseClient;
  db: Database;
  isVerified: boolean;
  close: () => Promise<void>;
  safeCleanup: (cleanupFn: () => Promise<void>) => Promise<void>;
}

/**
 * Loads environment files looking ONLY for TEST_DATABASE_URL.
 * NEVER reads or falls back to DATABASE_URL.
 */
export function loadTestEnv(): void {
  const candidatePaths = [
    resolve(process.cwd(), ".env.test"),
    resolve(process.cwd(), "../../.env.test"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ];

  for (const envPath of candidatePaths) {
    if (existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
        if (process.env["TEST_DATABASE_URL"]) {
          break;
        }
      } catch {
        // Ignore load errors for missing files
      }
    }
  }
}

/**
 * Creates a verified safe database context for testing.
 *
 * FAILS CLOSED:
 * 1. Checks that TEST_DATABASE_URL is set and targets 'barberkece_test' on localhost.
 * 2. Connects to PostgreSQL.
 * 3. Immediately validates that SELECT current_database() === 'barberkece_test'.
 * 4. Verifies loopback server address.
 * 5. If verification fails, connection is closed and an error is thrown.
 */
export async function createSafeTestDatabaseContext(): Promise<SafeTestDatabaseContext> {
  loadTestEnv();

  const testDbUrl = process.env["TEST_DATABASE_URL"];
  validateTestDatabaseUrl(testDbUrl);

  const dbClient = createDatabase(testDbUrl!);
  let isVerified = false;

  try {
    await verifyConnectedServer(dbClient.db);
    isVerified = true;
  } catch (error) {
    try {
      await dbClient.close();
    } catch {
      // Ignore secondary close error
    }
    throw error;
  }

  return {
    dbClient,
    db: dbClient.db,
    isVerified,
    close: async () => {
      await dbClient.close();
    },
    safeCleanup: async (cleanupFn: () => Promise<void>) => {
      if (!isVerified) {
        throw new TestDatabaseSafetyError(
          "Refusing to execute test cleanup on unverified database connection.",
        );
      }
      await cleanupFn();
    },
  };
}
