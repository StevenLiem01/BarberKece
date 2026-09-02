import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { createDatabase, DatabaseClient } from "../../client.js";
import { PostgresSessionRepository } from "../session-repository.js";
import { users } from "../../schema/identity/users.js";
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

describe("PostgresSessionRepository", () => {
  let dbClient: DatabaseClient;
  let repository: PostgresSessionRepository;
  let testUserId: string;

  beforeAll(async () => {
    dbClient = createDatabase(TEST_DB_URL);
    repository = new PostgresSessionRepository(dbClient.db);

    // Create a dummy user for foreign key constraints
    testUserId = uuidv7();
    await dbClient.db.insert(users).values({
      id: testUserId,
      email: `test-session-${Date.now()}@example.com`,
      passwordHash: "dummy-hash",
      role: "CUSTOMER",
      status: "ACTIVE",
    });
  });

  afterAll(async () => {
    // Cleanup: User deletion will cascade to sessions
    await dbClient.db.delete(users).where(eq(users.id, testUserId));
    await dbClient.close();
  });

  it("should create and find an active session", async () => {
    const tokenHash = `test-hash-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour future

    const newSession = await repository.createSession({
      id: uuidv7(),
      userId: testUserId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    });

    expect(newSession.id).toBeDefined();
    expect(newSession.tokenHash).toBe(tokenHash);

    const activeSession =
      await repository.findActiveSessionByTokenHash(tokenHash);
    expect(activeSession).not.toBeNull();
    expect(activeSession?.id).toBe(newSession.id);
  });

  it("should not return an expired session", async () => {
    const tokenHash = `expired-hash-${Date.now()}`;
    const expiresAt = new Date(Date.now() - 1000 * 60 * 60); // 1 hour past

    await repository.createSession({
      id: uuidv7(),
      userId: testUserId,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    });

    const activeSession =
      await repository.findActiveSessionByTokenHash(tokenHash);
    expect(activeSession).toBeNull();
  });

  it("should revoke a session by token hash", async () => {
    const tokenHash = `revoke-hash-${Date.now()}`;
    await repository.createSession({
      id: uuidv7(),
      userId: testUserId,
      tokenHash,
      expiresAt: new Date(Date.now() + 10000),
      createdAt: new Date(),
    });

    // Revoke it
    await repository.revokeSession(tokenHash);

    // Should no longer find it
    const activeSession =
      await repository.findActiveSessionByTokenHash(tokenHash);
    expect(activeSession).toBeNull();
  });

  it("should revoke all sessions for a user", async () => {
    const tokenHash1 = `revoke-all-1-${Date.now()}`;
    const tokenHash2 = `revoke-all-2-${Date.now()}`;

    await repository.createSession({
      id: uuidv7(),
      userId: testUserId,
      tokenHash: tokenHash1,
      expiresAt: new Date(Date.now() + 10000),
      createdAt: new Date(),
    });

    await repository.createSession({
      id: uuidv7(),
      userId: testUserId,
      tokenHash: tokenHash2,
      expiresAt: new Date(Date.now() + 10000),
      createdAt: new Date(),
    });

    // Revoke all
    await repository.revokeAllSessionsForUser(testUserId);

    // Should no longer find them
    const active1 = await repository.findActiveSessionByTokenHash(tokenHash1);
    const active2 = await repository.findActiveSessionByTokenHash(tokenHash2);
    expect(active1).toBeNull();
    expect(active2).toBeNull();
  });

  it("should return null for wrong token hash", async () => {
    const activeSession =
      await repository.findActiveSessionByTokenHash("wrong-hash");
    expect(activeSession).toBeNull();
  });

  it("should fail safely on invalid session creation", async () => {
    try {
      await repository.createSession({
        id: uuidv7(),
        userId: "non-existent-user-id", // Violates FK
        tokenHash: "will-fail-hash",
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const err = error as IdentityError;
      expect(err.name).toBe("IdentityError");
      expect(err.message).toBe("Database error during session creation");
    }
  });
});
