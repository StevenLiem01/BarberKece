import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { createDatabase, DatabaseClient } from "../../client.js";
import { PostgresUserRepository } from "../user-repository.js";
import { PostgresPasswordResetTokenRepository } from "../password-reset-token-repository.js";
import { users } from "../../schema/identity/users.js";
import { passwordResetTokens } from "../../schema/identity/password_reset_tokens.js";
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

describe("PostgresPasswordResetTokenRepository & UserRepository.updatePassword", () => {
  let dbClient: DatabaseClient;
  let userRepo: PostgresUserRepository;
  let tokenRepo: PostgresPasswordResetTokenRepository;
  const testUserIds: string[] = [];
  const testTokenIds: string[] = [];

  beforeAll(async () => {
    dbClient = createDatabase(TEST_DB_URL);
    userRepo = new PostgresUserRepository(dbClient.db);
    tokenRepo = new PostgresPasswordResetTokenRepository(dbClient.db);
  });

  afterAll(async () => {
    // Explicit test data safety: Clean up ONLY test-created tokens and users
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

  async function createTestUser(emailSuffix: string) {
    const userId = uuidv7();
    testUserIds.push(userId);
    const now = new Date();
    await userRepo.createUser({
      id: userId,
      email: `test-reset-${Date.now()}-${emailSuffix}@example.com`,
      passwordHash: "initial-password-hash",
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    return userId;
  }

  it("should create a password reset token with tokenHash and verify fields", async () => {
    const userId = await createTestUser("create");
    const tokenId = uuidv7();
    testTokenIds.push(tokenId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1800000);

    const created = await tokenRepo.createToken({
      id: tokenId,
      userId,
      tokenHash: `hash-${tokenId}`,
      expiresAt,
      usedAt: null,
      createdAt: now,
    });

    expect(created.id).toBe(tokenId);
    expect(created.userId).toBe(userId);
    expect(created.tokenHash).toBe(`hash-${tokenId}`);
    expect(created.usedAt).toBeNull();
    expect(created.expiresAt.getTime()).toBe(expiresAt.getTime());
  });

  it("should find and lock a token by tokenHash", async () => {
    const userId = await createTestUser("find-lock");
    const tokenId = uuidv7();
    testTokenIds.push(tokenId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1800000);

    await tokenRepo.createToken({
      id: tokenId,
      userId,
      tokenHash: `hash-${tokenId}`,
      expiresAt,
      usedAt: null,
      createdAt: now,
    });

    const found = await tokenRepo.findAndLockByTokenHash(`hash-${tokenId}`);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(tokenId);
    expect(found?.userId).toBe(userId);
    expect(found?.usedAt).toBeNull();

    const notFound =
      await tokenRepo.findAndLockByTokenHash("non-existent-hash");
    expect(notFound).toBeNull();
  });

  it("should consume token by setting used_at", async () => {
    const userId = await createTestUser("consume");
    const tokenId = uuidv7();
    testTokenIds.push(tokenId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1800000);

    await tokenRepo.createToken({
      id: tokenId,
      userId,
      tokenHash: `hash-${tokenId}`,
      expiresAt,
      usedAt: null,
      createdAt: now,
    });

    const consumedAt = new Date();
    await tokenRepo.consumeToken(tokenId, consumedAt);

    const found = await tokenRepo.findAndLockByTokenHash(`hash-${tokenId}`);
    expect(found?.usedAt).not.toBeNull();
    expect(found?.usedAt?.getTime()).toBe(consumedAt.getTime());
  });

  it("should invalidate only active unused tokens for user", async () => {
    const userId = await createTestUser("invalidation");
    const now = new Date();

    // 1. Active unused token
    const token1Id = uuidv7();
    testTokenIds.push(token1Id);
    await tokenRepo.createToken({
      id: token1Id,
      userId,
      tokenHash: `hash-${token1Id}`,
      expiresAt: new Date(now.getTime() + 1800000),
      usedAt: null,
      createdAt: now,
    });

    // 2. Already used token
    const token2Id = uuidv7();
    testTokenIds.push(token2Id);
    await tokenRepo.createToken({
      id: token2Id,
      userId,
      tokenHash: `hash-${token2Id}`,
      expiresAt: new Date(now.getTime() + 1800000),
      usedAt: new Date(now.getTime() - 10000),
      createdAt: now,
    });

    // 3. Already expired token
    const token3Id = uuidv7();
    testTokenIds.push(token3Id);
    await tokenRepo.createToken({
      id: token3Id,
      userId,
      tokenHash: `hash-${token3Id}`,
      expiresAt: new Date(now.getTime() - 10000),
      usedAt: null,
      createdAt: new Date(now.getTime() - 20000),
    });

    const invalidationTime = new Date();
    const count = await tokenRepo.invalidateActiveTokensForUser(
      userId,
      invalidationTime,
    );

    // Only token1 should have been invalidated
    expect(count).toBe(1);

    const t1 = await tokenRepo.findAndLockByTokenHash(`hash-${token1Id}`);
    expect(t1?.usedAt?.getTime()).toBe(invalidationTime.getTime());

    const t2 = await tokenRepo.findAndLockByTokenHash(`hash-${token2Id}`);
    expect(t2?.usedAt?.getTime()).toBeLessThan(invalidationTime.getTime());
  });

  it("should rollback token creation if transaction fails", async () => {
    const userId = await createTestUser("rollback");
    const tokenId = uuidv7();
    testTokenIds.push(tokenId);
    const now = new Date();

    await expect(
      dbClient.db.transaction(async (tx) => {
        const txRepo = new PostgresPasswordResetTokenRepository(tx);
        await txRepo.createToken({
          id: tokenId,
          userId,
          tokenHash: `hash-${tokenId}`,
          expiresAt: new Date(now.getTime() + 1800000),
          usedAt: null,
          createdAt: now,
        });

        throw new Error("Simulated transactional failure");
      }),
    ).rejects.toThrow("Simulated transactional failure");

    // Token must not exist after rollback
    const found = await tokenRepo.findAndLockByTokenHash(`hash-${tokenId}`);
    expect(found).toBeNull();
  });

  it("should update password in users table and reject non-existent user", async () => {
    const userId = await createTestUser("password-update");

    await userRepo.updatePassword(userId, "new-argon2-hashed-password");

    const user = await userRepo.findByEmail(
      (await userRepo.findById(userId))!.email,
    );
    expect(user?.passwordHash).toBe("new-argon2-hashed-password");

    await expect(
      userRepo.updatePassword(uuidv7(), "some-hash"),
    ).rejects.toThrow(new IdentityError("User not found for password update"));
  });
});
