import crypto from "node:crypto";
import { getDatabaseClient } from "../../src/lib/db";
import { schema, sql } from "@barberkece/database";
import {
  Argon2PasswordHashingAdapter,
  NodeCryptoTokenAdapter,
} from "@barberkece/infrastructure";

const client = getDatabaseClient();
const db = client.db;

// Track exactly what we create during this test execution
const trackedUserIds = new Set<string>();
const trackedTokenIds = new Set<string>();
const trackedSessionIds = new Set<string>();

/**
 * Strict database identity guard to ensure we are operating on the development database.
 * Aborts E2E setup immediately if the current database or user is incorrect.
 */
export async function assertDevDatabase() {
  const result = await db.execute(sql`
    SELECT current_database() as current_database, current_user as current_user;
  `);

  const currentDb = result[0]?.current_database;
  const currentUser = result[0]?.current_user;

  if (currentDb !== "barberkece_dev" || currentUser !== "barberkece_dev") {
    throw new Error(
      `FATAL: E2E database guard failed. Expected database 'barberkece_dev' and user 'barberkece_dev', ` +
        `but got database '${currentDb}' and user '${currentUser}'. Aborting to protect non-dev environments.`,
    );
  }
}

/**
 * Generates a globally unique email for E2E tests to avoid collisions.
 */
export function generateTestEmail(): string {
  // Use crypto.randomUUID() for uniqueness in the email string
  return `e2e_task040_${crypto.randomUUID()}@example.com`;
}

/**
 * Directly provisions a test CUSTOMER.
 * Uses exact ID tracking for cleanup.
 */
export async function createTestCustomer(password = "Password123!") {
  await assertDevDatabase();

  const email = generateTestEmail();

  const passwordHashing = new Argon2PasswordHashingAdapter();
  const passwordHash = await passwordHashing.hashPassword(password);

  const [insertedUser] = await db
    .insert(schema.users)
    .values({
      email,
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: schema.users.id });

  trackedUserIds.add(insertedUser.id);

  return { id: insertedUser.id, email, password };
}

/**
 * Directly provisions a test BARBER or ADMIN.
 * Uses exact ID tracking for cleanup.
 */
export async function createTestStaff(
  role: "BARBER" | "ADMIN",
  password = "Password123!",
) {
  await assertDevDatabase();

  const email = generateTestEmail();

  const passwordHashing = new Argon2PasswordHashingAdapter();
  const passwordHash = await passwordHashing.hashPassword(password);

  const [insertedUser] = await db
    .insert(schema.users)
    .values({
      email,
      passwordHash,
      role,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: schema.users.id });

  trackedUserIds.add(insertedUser.id);

  return { id: insertedUser.id, email, password };
}

/**
 * Provisions a password reset token for a given user using canonical crypto primitives.
 * Returns the RAW token to the test while persisting ONLY the hash.
 */
export async function createResetTokenForUser(userId: string) {
  await assertDevDatabase();

  const tokenAdapter = new NodeCryptoTokenAdapter();
  const rawToken = await tokenAdapter.generateToken();
  const tokenHash = await tokenAdapter.hashToken(rawToken);

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 30 * 60 * 1000); // Canonical 30 minutes

  const [insertedToken] = await db
    .insert(schema.passwordResetTokens)
    .values({
      userId,
      tokenHash,
      expiresAt,
      createdAt,
      usedAt: null,
    })
    .returning({ id: schema.passwordResetTokens.id });

  trackedTokenIds.add(insertedToken.id);

  return { id: insertedToken.id, rawToken };
}

/**
 * Tracks a session ID for cleanup if created during E2E outside the normal cascade.
 */
export function trackSessionId(sessionId: string) {
  trackedSessionIds.add(sessionId);
}

/**
 * Cleans up EXACTLY the records provisioned by these helpers.
 * Never TRUNCATEs, never uses broad DELETEs. Relies on canonical FK cascades where possible.
 */
export async function cleanupExactIds() {
  await assertDevDatabase();

  // We rely on foreign keys ON DELETE CASCADE for sessions and password_reset_tokens
  // when deleting the user, but we explicitly delete tracked sessions/tokens just to be thorough and safe.

  if (trackedSessionIds.size > 0) {
    const sessionIds = Array.from(trackedSessionIds);
    for (const id of sessionIds) {
      await db
        .delete(schema.sessions)
        .where(sql`${schema.sessions.id} = ${id}`);
    }
    trackedSessionIds.clear();
  }

  if (trackedTokenIds.size > 0) {
    const tokenIds = Array.from(trackedTokenIds);
    for (const id of tokenIds) {
      await db
        .delete(schema.passwordResetTokens)
        .where(sql`${schema.passwordResetTokens.id} = ${id}`);
    }
    trackedTokenIds.clear();
  }

  if (trackedUserIds.size > 0) {
    const userIds = Array.from(trackedUserIds);
    for (const id of userIds) {
      await db.delete(schema.users).where(sql`${schema.users.id} = ${id}`);
    }
    trackedUserIds.clear();
  }
}
