import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and, isNull, gt } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { createDatabase, DatabaseClient } from "../../client.js";
import { PostgresUserRepository } from "../user-repository.js";
import { PostgresPasswordResetTokenRepository } from "../password-reset-token-repository.js";
import { PostgresSessionRepository } from "../session-repository.js";
import { users } from "../../schema/identity/users.js";
import { passwordResetTokens } from "../../schema/identity/password_reset_tokens.js";
import { sessions } from "../../schema/identity/sessions.js";
import { IdentityError } from "@barberkece/core/identity";

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const candidatePaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
];

for (const envPath of candidatePaths) {
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      if (process.env["DATABASE_URL"]) {
        break;
      }
    } catch {
      // Ignore
    }
  }
}

const TEST_DB_URL =
  process.env["DATABASE_URL"] ||
  "postgres://barberkece_dev:devpassword@localhost:5432/barberkece_dev";

describe("Password Reset Concurrency (Integration)", () => {
  let dbClient: DatabaseClient;
  let userRepo: PostgresUserRepository;
  let tokenRepo: PostgresPasswordResetTokenRepository;
  let sessionRepo: PostgresSessionRepository;

  const testUserIds: string[] = [];
  const testTokenIds: string[] = [];
  const testSessionIds: string[] = [];

  beforeAll(() => {
    dbClient = createDatabase(TEST_DB_URL);
    userRepo = new PostgresUserRepository(dbClient.db);
    tokenRepo = new PostgresPasswordResetTokenRepository(dbClient.db);
    sessionRepo = new PostgresSessionRepository(dbClient.db);
  });

  afterAll(async () => {
    // Explicit test data safety: Clean up ONLY test-created sessions, tokens, and users
    for (const sessionId of testSessionIds) {
      await dbClient.db.delete(sessions).where(eq(sessions.id, sessionId));
    }
    for (const tokenId of testTokenIds) {
      await dbClient.db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.id, tokenId));
    }
    for (const userId of testUserIds) {
      await dbClient.db.delete(users).where(eq(users.id, userId));
    }
    await dbClient.close();
  });

  async function createTestUser(suffix: string) {
    const userId = uuidv7();
    testUserIds.push(userId);
    const now = new Date();
    await userRepo.createUser({
      id: userId,
      email: `concurrency-${Date.now()}-${suffix}@example.com`,
      passwordHash: "initial-hash",
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    return userId;
  }

  it("REQUEST CONCURRENCY: serializes concurrent reset requests for the SAME user leaving exactly ONE active token", async () => {
    const userId = await createTestUser("req-same-user");

    async function executeIssuance(label: string) {
      return await dbClient.db.transaction(async (tx) => {
        const txTokenRepo = new PostgresPasswordResetTokenRepository(tx);

        // 1. Advisory lock per-user
        await txTokenRepo.acquireUserIssuanceLock(userId);

        const now = new Date();
        // 2. Invalidate prior active tokens
        await txTokenRepo.invalidateActiveTokensForUser(userId, now);

        // 3. Create new token
        const tokenId = uuidv7();
        testTokenIds.push(tokenId);
        const tokenHash = `hash-${label}-${tokenId}`;

        return await txTokenRepo.createToken({
          id: tokenId,
          userId,
          tokenHash,
          expiresAt: new Date(now.getTime() + 1800000),
          usedAt: null,
          createdAt: now,
        });
      });
    }

    // Execute two concurrent issuances for the SAME user
    const [res1, res2] = await Promise.all([
      executeIssuance("op1"),
      executeIssuance("op2"),
    ]);

    expect(res1).toBeDefined();
    expect(res2).toBeDefined();

    // Query all tokens for this user
    const userTokens = await dbClient.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    expect(userTokens.length).toBe(2);

    // Invariant: At most and exactly ONE active usable reset token exists
    const now = new Date();
    const activeTokens = userTokens.filter(
      (t) => t.usedAt === null && t.expiresAt.getTime() > now.getTime(),
    );
    const invalidatedTokens = userTokens.filter((t) => t.usedAt !== null);

    expect(activeTokens.length).toBe(1);
    expect(invalidatedTokens.length).toBe(1);
  });

  it("REQUEST CONCURRENCY: advisory lock does not block concurrent reset requests for DIFFERENT users", async () => {
    const userA = await createTestUser("user-a");
    const userB = await createTestUser("user-b");

    async function executeIssuanceFor(userId: string, label: string) {
      return await dbClient.db.transaction(async (tx) => {
        const txTokenRepo = new PostgresPasswordResetTokenRepository(tx);
        await txTokenRepo.acquireUserIssuanceLock(userId);

        const now = new Date();
        await txTokenRepo.invalidateActiveTokensForUser(userId, now);

        const tokenId = uuidv7();
        testTokenIds.push(tokenId);
        return await txTokenRepo.createToken({
          id: tokenId,
          userId,
          tokenHash: `hash-${label}-${tokenId}`,
          expiresAt: new Date(now.getTime() + 1800000),
          usedAt: null,
          createdAt: now,
        });
      });
    }

    // Concurrent issuance for User A and User B
    const [tokenA, tokenB] = await Promise.all([
      executeIssuanceFor(userA, "a"),
      executeIssuanceFor(userB, "b"),
    ]);

    expect(tokenA.userId).toBe(userA);
    expect(tokenB.userId).toBe(userB);

    // Both users have exactly 1 active token
    const now = new Date();
    const activeA = await dbClient.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, userA),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      );
    const activeB = await dbClient.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, userB),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      );

    expect(activeA.length).toBe(1);
    expect(activeB.length).toBe(1);
  });

  it("CONFIRM CONCURRENCY: exactly one concurrent confirmation with SAME token succeeds, second fails safely", async () => {
    const userId = await createTestUser("confirm-same-token");

    // Create active session for user
    const sessionId = uuidv7();
    testSessionIds.push(sessionId);
    await sessionRepo.createSession({
      id: sessionId,
      userId,
      tokenHash: `session-hash-${sessionId}`,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    });

    // Create a single active token
    const tokenId = uuidv7();
    testTokenIds.push(tokenId);
    const tokenHash = `shared-confirm-hash-${tokenId}`;
    const now = new Date();

    await tokenRepo.createToken({
      id: tokenId,
      userId,
      tokenHash,
      expiresAt: new Date(now.getTime() + 1800000),
      usedAt: null,
      createdAt: now,
    });

    async function executeConfirm(newPasswordHash: string) {
      return await dbClient.db.transaction(async (tx) => {
        const txTokenRepo = new PostgresPasswordResetTokenRepository(tx);
        const txUserRepo = new PostgresUserRepository(tx);
        const txSessionRepo = new PostgresSessionRepository(tx);

        // 1. SELECT ... FOR UPDATE on token row
        const lockedToken = await txTokenRepo.findAndLockByTokenHash(tokenHash);
        if (!lockedToken) {
          throw new IdentityError("Invalid or expired password reset token");
        }

        // 2. Revalidate under row lock
        const checkTime = new Date();
        if (
          lockedToken.usedAt !== null ||
          lockedToken.expiresAt.getTime() <= checkTime.getTime()
        ) {
          throw new IdentityError("Invalid or expired password reset token");
        }

        // 3. Update password
        await txUserRepo.updatePassword(lockedToken.userId, newPasswordHash);

        // 4. Consume token
        await txTokenRepo.consumeToken(lockedToken.id, checkTime);

        // 5. Revoke all sessions
        await txSessionRepo.revokeAllSessionsForUser(lockedToken.userId);

        return { success: true, updatedPasswordHash: newPasswordHash };
      });
    }

    // Launch two concurrent confirmations presenting the SAME token
    const results = await Promise.allSettled([
      executeConfirm("hash-attempt-1"),
      executeConfirm("hash-attempt-2"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Invariant: Exactly one succeeds, exactly one fails
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // The rejected error must be IdentityError with safe message
    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectionReason).toBeInstanceOf(IdentityError);
    expect(rejectionReason.message).toBe(
      "Invalid or expired password reset token",
    );

    // Token must now be consumed
    const consumedToken = await tokenRepo.findAndLockByTokenHash(tokenHash);
    expect(consumedToken?.usedAt).not.toBeNull();

    // All sessions for the user must be revoked
    const activeSession = await sessionRepo.findActiveSessionByTokenHash(
      `session-hash-${sessionId}`,
    );
    expect(activeSession).toBeNull();
  });
});
