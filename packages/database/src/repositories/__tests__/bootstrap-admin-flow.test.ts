import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  createDatabase,
  DatabaseClient,
  BOOTSTRAP_ADMIN_ADVISORY_LOCK_ID,
} from "../../index.js";
import { PostgresUserRepository } from "../user-repository.js";
import { users } from "../../schema/identity/users.js";
import {
  BootstrapAdminUseCase,
  IdentityError,
  User,
} from "@barberkece/core/identity";
import { Argon2PasswordHashingAdapter } from "@barberkece/infrastructure/identity";

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

async function executeTransactionalBootstrap(
  client: DatabaseClient,
  email: string,
  passwordRaw: string,
  passwordHashing: Argon2PasswordHashingAdapter,
) {
  return await client.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_ADMIN_ADVISORY_LOCK_ID})`,
    );
    const txRepo = new PostgresUserRepository(tx);
    const useCase = new BootstrapAdminUseCase(txRepo, passwordHashing);
    return await useCase.execute({ email, passwordRaw });
  });
}

describe("BootstrapAdmin Flow (Integration)", () => {
  let dbClient: DatabaseClient;
  let repository: PostgresUserRepository;
  let passwordHashing: Argon2PasswordHashingAdapter;
  let preExistingAdminCount: number;
  const createdAdminIds: string[] = [];

  beforeAll(async () => {
    dbClient = createDatabase(TEST_DB_URL);
    repository = new PostgresUserRepository(dbClient.db);
    passwordHashing = new Argon2PasswordHashingAdapter();
    preExistingAdminCount = await repository.countByRole("ADMIN");
  });

  afterAll(async () => {
    // Safely delete ONLY records created by this test suite
    for (const adminId of createdAdminIds) {
      await dbClient.db.delete(users).where(eq(users.id, adminId));
    }
    await dbClient.close();
  });

  it("successfully creates the initial admin in PostgreSQL with real Argon2id password hash", async () => {
    if (preExistingAdminCount > 0) {
      // If an admin already exists in the dev database, test cannot create a first admin without violating invariants
      return;
    }

    const adminEmail = `integration-admin-${Date.now()}@barberkece.com`;
    const adminPassword = "securePassword123!";

    const admin = await executeTransactionalBootstrap(
      dbClient,
      adminEmail,
      adminPassword,
      passwordHashing,
    );

    createdAdminIds.push(admin.id);

    expect(admin.id).toBeDefined();
    expect(admin.email).toBe(adminEmail.toLowerCase());
    expect(admin.role).toBe("ADMIN");
    expect(admin.status).toBe("ACTIVE");
    expect(
      (admin as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined();

    // Verify in database that password was hashed with real Argon2id and not stored as plaintext
    const inDb = await repository.findByEmail(adminEmail.toLowerCase());
    expect(inDb).not.toBeNull();
    expect(inDb?.passwordHash).toMatch(/^\$argon2id\$v=19\$/);
    expect(inDb?.passwordHash).not.toBe(adminPassword);

    // Verify verifyPassword works with the real Argon2id hash
    const isMatch = await passwordHashing.verifyPassword(
      inDb!.passwordHash,
      adminPassword,
    );
    expect(isMatch).toBe(true);

    const isWrongMatch = await passwordHashing.verifyPassword(
      inDb!.passwordHash,
      "wrongPassword123!",
    );
    expect(isWrongMatch).toBe(false);
  });

  it("refuses to bootstrap a second admin when an ADMIN already exists", async () => {
    const secondAdminEmail = `second-admin-${Date.now()}@barberkece.com`;

    await expect(
      executeTransactionalBootstrap(
        dbClient,
        secondAdminEmail,
        "anotherSecurePass123",
        passwordHashing,
      ),
    ).rejects.toThrowError(
      new IdentityError(
        "An ADMIN account already exists. Additional admins must be provisioned through the authorized admin flow.",
      ),
    );
  });

  it("rejects short password or invalid input before touching the database", async () => {
    const useCase = new BootstrapAdminUseCase(repository, passwordHashing);
    await expect(
      useCase.execute({
        email: "test@barberkece.com",
        passwordRaw: "short",
      }),
    ).rejects.toThrowError(
      new IdentityError("Password must be at least 8 characters"),
    );
  });

  it("serializes concurrent initial admin bootstrap attempts using PostgreSQL advisory lock", async () => {
    if (preExistingAdminCount > 0) {
      // Cannot safely test concurrent first-admin creation if a pre-existing admin already exists in the shared DB
      return;
    }

    // Clean up previous test admin so we start from zero admins for the concurrency test
    for (const adminId of createdAdminIds) {
      await dbClient.db.delete(users).where(eq(users.id, adminId));
    }
    createdAdminIds.length = 0;

    const emailA = `concurrent-admin-a-${Date.now()}@barberkece.com`;
    const emailB = `concurrent-admin-b-${Date.now()}@barberkece.com`;
    const password = "concurrentSecurePassword123!";

    // Launch two bootstrap operations simultaneously against PostgreSQL
    const results = await Promise.allSettled([
      executeTransactionalBootstrap(
        dbClient,
        emailA,
        password,
        passwordHashing,
      ),
      executeTransactionalBootstrap(
        dbClient,
        emailB,
        password,
        passwordHashing,
      ),
    ]);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<User> => r.status === "fulfilled",
    );
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    // Exactly one must succeed and exactly one must fail
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const winningAdmin = fulfilled[0]?.value;
    expect(winningAdmin).toBeDefined();
    if (winningAdmin) {
      createdAdminIds.push(winningAdmin.id);
    }

    const rejectionReason = rejected[0]?.reason;
    expect(rejectionReason).toBeInstanceOf(IdentityError);
    expect((rejectionReason as Error).message).toBe(
      "An ADMIN account already exists. Additional admins must be provisioned through the authorized admin flow.",
    );

    // Authoritative check: only 1 ADMIN exists in PostgreSQL
    const currentAdminCount = await repository.countByRole("ADMIN");
    expect(currentAdminCount).toBe(1);
  });
});
