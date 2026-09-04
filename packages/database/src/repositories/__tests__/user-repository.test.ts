import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { createDatabase, DatabaseClient } from "../../client.js";
import { PostgresUserRepository } from "../user-repository.js";
import { users } from "../../schema/identity/users.js";
import { IdentityError, UserRole } from "@barberkece/core/identity";

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

describe("PostgresUserRepository", () => {
  let dbClient: DatabaseClient;
  let repository: PostgresUserRepository;
  let testUserId: string;

  beforeAll(() => {
    dbClient = createDatabase(TEST_DB_URL);
    repository = new PostgresUserRepository(dbClient.db);
    testUserId = uuidv7();
  });

  afterAll(async () => {
    // Cleanup created users
    await dbClient.db.delete(users).where(eq(users.id, testUserId));
    await dbClient.close();
  });

  it("should create a user and return it without returning password details incorrectly", async () => {
    const email = `test-user-${Date.now()}@example.com`;
    const now = new Date();

    const user = await repository.createUser({
      id: testUserId,
      email,
      passwordHash: "dummy-hash-1",
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    expect(user.id).toBe(testUserId);
    expect(user.email).toBe(email);
    expect(user.role).toBe("CUSTOMER");
    expect(user.status).toBe("ACTIVE");
    expect(
      (user as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined(); // Should not be in the returned type
  });

  it("should throw safe IdentityError on duplicate email", async () => {
    const duplicateEmail = `duplicate-${Date.now()}@example.com`;
    const now = new Date();
    const id1 = uuidv7();
    const id2 = uuidv7();

    // First insert
    await repository.createUser({
      id: id1,
      email: duplicateEmail,
      passwordHash: "hash-1",
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    // Cleanup the first user later
    const cleanupId1 = async () => {
      await dbClient.db.delete(users).where(eq(users.id, id1));
    };

    try {
      // Second insert should fail
      await repository.createUser({
        id: id2,
        email: duplicateEmail,
        passwordHash: "hash-2",
        role: "CUSTOMER",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      });
      expect.fail("Should have thrown on duplicate email");
    } catch (error: unknown) {
      const err = error as IdentityError;
      expect(err.name).toBe("IdentityError");
      expect(err.message).toBe("Email is already registered");
    } finally {
      await cleanupId1();
    }
  });

  it("should find a user by email and include passwordHash", async () => {
    const email = `find-${Date.now()}@example.com`;
    const now = new Date();
    const id = uuidv7();

    await repository.createUser({
      id,
      email,
      passwordHash: "secret-hash",
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    const found = await repository.findByEmail(email);
    expect(found).not.toBeNull();
    expect(found?.email).toBe(email);
    expect(found?.passwordHash).toBe("secret-hash");

    // Cleanup
    await dbClient.db.delete(users).where(eq(users.id, id));
  });

  it("should find a user by ID without passwordHash", async () => {
    const email = `find-id-${Date.now()}@example.com`;
    const now = new Date();
    const id = uuidv7();

    await repository.createUser({
      id,
      email,
      passwordHash: "secret-hash",
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    const found = await repository.findById(id);
    expect(found).not.toBeNull();
    expect(found?.email).toBe(email);
    expect(
      (found as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined();

    // Cleanup
    await dbClient.db.delete(users).where(eq(users.id, id));
  });

  it("should fail safely on constraint violation like bad role", async () => {
    const now = new Date();
    const id = uuidv7();

    try {
      await repository.createUser({
        id,
        email: `bad-role-${Date.now()}@example.com`,
        passwordHash: "hash",
        role: "INVALID_ROLE" as unknown as UserRole,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      });
      expect.fail("Should have thrown on bad role");
    } catch (error: unknown) {
      const err = error as IdentityError;
      expect(err.name).toBe("IdentityError");
      expect(err.message).toBe("Database error during user creation");
    }
  });

  it("should correctly count users by role", async () => {
    const email = `admin-count-${Date.now()}@example.com`;
    const now = new Date();
    const id = uuidv7();

    const initialCount = await repository.countByRole("ADMIN");

    await repository.createUser({
      id,
      email,
      passwordHash: "hash",
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    try {
      const updatedCount = await repository.countByRole("ADMIN");
      expect(updatedCount).toBe(initialCount + 1);
    } finally {
      await dbClient.db.delete(users).where(eq(users.id, id));
    }

    const finalCount = await repository.countByRole("ADMIN");
    expect(finalCount).toBe(initialCount);
  });
});
