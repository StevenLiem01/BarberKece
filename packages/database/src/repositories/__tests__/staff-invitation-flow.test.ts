import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { DatabaseClient } from "../../client.js";
import {
  PostgresStaffInvitationRepository,
  PostgresStaffInvitationTransactionRunner,
} from "../index.js";
import {
  staffInvitations,
  users,
  barberProfiles,
} from "../../schema/index.js";
import {
  CreateStaffInvitationUseCase,
  AcceptStaffInvitationUseCase,
  StaffInvitationAlreadyUsedError,
  IdentityError,
} from "@barberkece/core/identity";
import {
  Argon2PasswordHashingAdapter,
  NodeCryptoTokenAdapter,
} from "@barberkece/infrastructure/identity";
import {
  createSafeTestDatabaseContext,
  type SafeTestDatabaseContext,
} from "../../testing/index.js";

interface TestEmailPort {
  sendEmail(message: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ messageId: string; deliveredAt: Date }>;
}

describe("PostgreSQL Staff Invitation Flow & Concurrency (F-05A)", () => {
  let safeDb: SafeTestDatabaseContext | undefined;
  let dbClient: DatabaseClient;
  let runner: PostgresStaffInvitationTransactionRunner;
  let invitationRepo: PostgresStaffInvitationRepository;
  let passwordHashing: Argon2PasswordHashingAdapter;
  let tokenPort: NodeCryptoTokenAdapter;

  const cleanupUserIds: string[] = [];
  const cleanupInvitationIds: string[] = [];
  const cleanupBarberProfileIds: string[] = [];

  const mockEmailPort: TestEmailPort = {
    sendEmail: async () => ({
      messageId: uuidv7(),
      deliveredAt: new Date(),
    }),
  };

  beforeAll(async () => {
    safeDb = await createSafeTestDatabaseContext();
    dbClient = safeDb.dbClient;
    runner = new PostgresStaffInvitationTransactionRunner(dbClient.db);
    invitationRepo = new PostgresStaffInvitationRepository(dbClient.db);
    passwordHashing = new Argon2PasswordHashingAdapter();
    tokenPort = new NodeCryptoTokenAdapter();
  });

  afterAll(async () => {
    if (safeDb?.isVerified) {
      await safeDb.safeCleanup(async () => {
        if (cleanupBarberProfileIds.length > 0) {
          await dbClient.db
            .delete(barberProfiles)
            .where(inArray(barberProfiles.id, cleanupBarberProfileIds));
        }
        if (cleanupInvitationIds.length > 0) {
          await dbClient.db
            .delete(staffInvitations)
            .where(inArray(staffInvitations.id, cleanupInvitationIds));
        }
        if (cleanupUserIds.length > 0) {
          await dbClient.db
            .delete(users)
            .where(inArray(users.id, cleanupUserIds));
        }
      });
      await safeDb.close();
    }
  });

  it("1. staff_invitations.display_name and token hash persistence (hash stored, plaintext never stored)", async () => {
    const rawToken = await tokenPort.generateToken();
    const tokenHash = await tokenPort.hashToken(rawToken);
    const invitationId = uuidv7();
    cleanupInvitationIds.push(invitationId);

    const email = `staff-hash-test-${invitationId.slice(0, 8)}@barberkece.test`;
    const displayName = "Ahmad Barber Specialist";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 3600 * 1000);

    const created = await invitationRepo.createInvitation({
      id: invitationId,
      email,
      displayName,
      role: "BARBER",
      tokenHash,
      expiresAt,
      usedAt: null,
      createdAt: now,
    });

    expect(created.id).toBe(invitationId);
    expect(created.displayName).toBe(displayName);
    expect(created.tokenHash).toBe(tokenHash);

    // Direct SQL verification of physical columns in PostgreSQL
    const rows = (await dbClient.db.execute(
      sql`SELECT id, email, display_name, token_hash, role, used_at FROM staff_invitations WHERE id = ${invitationId}`,
    )) as Array<{
      id: string;
      email: string;
      display_name: string;
      token_hash: string;
      role: string;
      used_at: Date | null;
    }>;

    expect(rows.length).toBe(1);
    expect(rows[0].display_name).toBe(displayName);
    expect(rows[0].token_hash).toBe(tokenHash);
    expect(rows[0].used_at).toBeNull();

    // Verify plaintext rawToken is NEVER stored in database
    const plaintextCheck = (await dbClient.db.execute(
      sql`SELECT id FROM staff_invitations WHERE token_hash = ${rawToken}`,
    )) as Array<{ id: string }>;
    expect(plaintextCheck.length).toBe(0);
  });

  it("2. Database uniqueness and role check constraints on staff_invitations", async () => {
    const rawToken = await tokenPort.generateToken();
    const tokenHash = await tokenPort.hashToken(rawToken);
    const id1 = uuidv7();
    const id2 = uuidv7();
    cleanupInvitationIds.push(id1);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600 * 1000);

    // Insert first invitation
    await invitationRepo.createInvitation({
      id: id1,
      email: `unique-test-1-${id1.slice(0, 8)}@barberkece.test`,
      displayName: "Unique Barber One",
      role: "BARBER",
      tokenHash,
      expiresAt,
      usedAt: null,
      createdAt: now,
    });

    // Attempt duplicate tokenHash insert - must fail unique constraint
    await expect(
      invitationRepo.createInvitation({
        id: id2,
        email: `unique-test-2-${id2.slice(0, 8)}@barberkece.test`,
        displayName: "Unique Barber Two",
        role: "BARBER",
        tokenHash, // Colliding token hash
        expiresAt,
        usedAt: null,
        createdAt: now,
      }),
    ).rejects.toThrow(IdentityError);

    // Attempt invalid role insert violating check constraint (staff_invitations_role_check)
    const invalidRoleId = uuidv7();
    await expect(
      dbClient.db.execute(
        sql`INSERT INTO staff_invitations (id, email, role, token_hash, expires_at)
            VALUES (${invalidRoleId}, 'badrole@barberkece.test', 'CUSTOMER', ${await tokenPort.hashToken(await tokenPort.generateToken())}, ${expiresAt})`,
      ),
    ).rejects.toThrow();
  });

  it("3. Previous invitation invalidation & case-insensitive email normalization", async () => {
    const baseEmail = `normalize-${uuidv7().slice(0, 8)}@barberkece.test`;
    const upperEmail = baseEmail.toUpperCase();
    const now = new Date();

    const t1 = await tokenPort.generateToken();
    const h1 = await tokenPort.hashToken(t1);
    const id1 = uuidv7();
    cleanupInvitationIds.push(id1);

    // Create initial invitation
    await invitationRepo.createInvitation({
      id: id1,
      email: baseEmail,
      displayName: "Normalize Barber",
      role: "BARBER",
      tokenHash: h1,
      expiresAt: new Date(now.getTime() + 48 * 3600 * 1000),
      usedAt: null,
      createdAt: now,
    });

    // Invalidate active invitations using uppercase email
    const invalidatedCount =
      await invitationRepo.invalidateActiveInvitationsForEmail(
        upperEmail,
        new Date(),
      );
    expect(invalidatedCount).toBe(1);

    // Verify in PostgreSQL that the initial invitation is now marked used
    const [row1] = (await dbClient.db.execute(
      sql`SELECT used_at FROM staff_invitations WHERE id = ${id1}`,
    )) as Array<{ used_at: Date | null }>;
    expect(row1.used_at).not.toBeNull();
  });

  it("4. Concurrent invitation issuance for the same normalized email serializes via advisory lock", async () => {
    const targetEmail = `concurrent-issue-${uuidv7().slice(0, 8)}@barberkece.test`;
    const createUseCase = new CreateStaffInvitationUseCase(
      runner,
      tokenPort,
      mockEmailPort,
      "http://localhost:3000",
    );

    // Simultaneously trigger two invitation issuances for the same normalized email
    const [res1, res2] = await Promise.all([
      createUseCase.execute({
        displayName: "Concurrent Barber 1",
        email: targetEmail.toLowerCase(),
        role: "BARBER",
      }),
      createUseCase.execute({
        displayName: "Concurrent Barber 2",
        email: targetEmail.toUpperCase(),
        role: "BARBER",
      }),
    ]);

    cleanupInvitationIds.push(res1.id, res2.id);

    expect(res1.id).not.toBe(res2.id);

    // Verify in PostgreSQL: exactly one is active (used_at IS NULL), the other is invalidated (used_at IS NOT NULL)
    const rows = (await dbClient.db.execute(
      sql`SELECT id, used_at FROM staff_invitations WHERE id IN (${res1.id}, ${res2.id}) ORDER BY created_at ASC`,
    )) as Array<{ id: string; used_at: Date | null }>;

    expect(rows.length).toBe(2);
    const active = rows.filter((r) => r.used_at === null);
    const invalidated = rows.filter((r) => r.used_at !== null);

    expect(active.length).toBe(1);
    expect(invalidated.length).toBe(1);
  });

  it("5. Acceptance with role BARBER persists users.display_name, emailVerifiedAt, and provisions barber_profiles atomically", async () => {
    const rawToken = await tokenPort.generateToken();
    const tokenHash = await tokenPort.hashToken(rawToken);
    const invitationId = uuidv7();
    cleanupInvitationIds.push(invitationId);

    const email = `barber-accept-${invitationId.slice(0, 8)}@barberkece.test`;
    const displayName = "Raden Mas Barber";
    const now = new Date();

    await invitationRepo.createInvitation({
      id: invitationId,
      email,
      displayName,
      role: "BARBER",
      tokenHash,
      expiresAt: new Date(now.getTime() + 48 * 3600 * 1000),
      usedAt: null,
      createdAt: now,
    });

    const acceptUseCase = new AcceptStaffInvitationUseCase(
      runner,
      passwordHashing,
      tokenPort,
    );

    const { user } = await acceptUseCase.execute({
      token: rawToken,
      passwordRaw: "SuperSecureBarber123!",
    });

    cleanupUserIds.push(user.id);

    // Verify returned User entity
    expect(user.displayName).toBe(displayName);
    expect(user.role).toBe("BARBER");
    expect(user.status).toBe("ACTIVE");
    expect(user.emailVerifiedAt).not.toBeNull();

    // Verify physical database row in users
    const [userRow] = (await dbClient.db.execute(
      sql`SELECT id, email, display_name, role, status, email_verified_at FROM users WHERE id = ${user.id}`,
    )) as Array<{
      id: string;
      email: string;
      display_name: string;
      role: string;
      status: string;
      email_verified_at: Date | null;
    }>;

    expect(userRow.display_name).toBe(displayName);
    expect(userRow.role).toBe("BARBER");
    expect(userRow.email_verified_at).not.toBeNull();

    // Verify barber_profiles record was created atomically in PostgreSQL
    const barberProfilesRows = (await dbClient.db.execute(
      sql`SELECT id, user_id FROM barber_profiles WHERE user_id = ${user.id}`,
    )) as Array<{ id: string; user_id: string }>;

    expect(barberProfilesRows.length).toBe(1);
    cleanupBarberProfileIds.push(barberProfilesRows[0].id);

    // Verify staff_invitations was marked consumed (used_at IS NOT NULL)
    const [invRow] = (await dbClient.db.execute(
      sql`SELECT used_at FROM staff_invitations WHERE id = ${invitationId}`,
    )) as Array<{ used_at: Date | null }>;
    expect(invRow.used_at).not.toBeNull();
  });

  it("6. Acceptance with role ADMIN persists users.display_name, emailVerifiedAt, and does NOT provision barber_profiles", async () => {
    const rawToken = await tokenPort.generateToken();
    const tokenHash = await tokenPort.hashToken(rawToken);
    const invitationId = uuidv7();
    cleanupInvitationIds.push(invitationId);

    const email = `admin-accept-${invitationId.slice(0, 8)}@barberkece.test`;
    const displayName = "Dewi Admin Utama";
    const now = new Date();

    await invitationRepo.createInvitation({
      id: invitationId,
      email,
      displayName,
      role: "ADMIN",
      tokenHash,
      expiresAt: new Date(now.getTime() + 48 * 3600 * 1000),
      usedAt: null,
      createdAt: now,
    });

    const acceptUseCase = new AcceptStaffInvitationUseCase(
      runner,
      passwordHashing,
      tokenPort,
    );

    let createdUserId: string | undefined;
    try {
      const { user } = await acceptUseCase.execute({
        token: rawToken,
        passwordRaw: "SuperSecureAdmin123!",
      });

      createdUserId = user.id;
      cleanupUserIds.push(user.id);

      // Verify user entity & physical table
      expect(user.displayName).toBe(displayName);
      expect(user.role).toBe("ADMIN");
      expect(user.emailVerifiedAt).not.toBeNull();

      const [userRow] = (await dbClient.db.execute(
        sql`SELECT display_name, role, email_verified_at FROM users WHERE id = ${user.id}`,
      )) as Array<{
        display_name: string;
        role: string;
        email_verified_at: Date | null;
      }>;
      expect(userRow.display_name).toBe(displayName);
      expect(userRow.role).toBe("ADMIN");
      expect(userRow.email_verified_at).not.toBeNull();

      // Verify NO barber_profiles record exists for admin
      const barberProfilesRows = (await dbClient.db.execute(
        sql`SELECT id FROM barber_profiles WHERE user_id = ${user.id}`,
      )) as Array<{ id: string }>;
      expect(barberProfilesRows.length).toBe(0);

      // Verify invitation marked consumed
      const [invRow] = (await dbClient.db.execute(
        sql`SELECT used_at FROM staff_invitations WHERE id = ${invitationId}`,
      )) as Array<{ used_at: Date | null }>;
      expect(invRow.used_at).not.toBeNull();
    } finally {
      if (createdUserId) {
        await dbClient.db.delete(users).where(eq(users.id, createdUserId));
      }
    }
  });

  it("7. Transaction rollback on acceptance failure preserves database integrity", async () => {
    const rawToken = await tokenPort.generateToken();
    const tokenHash = await tokenPort.hashToken(rawToken);
    const invitationId = uuidv7();
    cleanupInvitationIds.push(invitationId);

    const email = `rollback-test-${invitationId.slice(0, 8)}@barberkece.test`;
    const displayName = "Gagal Transaksi";
    const now = new Date();

    await invitationRepo.createInvitation({
      id: invitationId,
      email,
      displayName,
      role: "BARBER",
      tokenHash,
      expiresAt: new Date(now.getTime() + 48 * 3600 * 1000),
      usedAt: null,
      createdAt: now,
    });

    const intendedUserId = uuidv7();

    // Simulate an aborted acceptance transaction by throwing inside runner.run
    await expect(
      runner.run(async ({ userRepository, staffInvitationRepository, barberProfileRepository }) => {
        const inv = await staffInvitationRepository.findAndLockByTokenHash(tokenHash);
        expect(inv).not.toBeNull();

        await userRepository.createUser({
          id: intendedUserId,
          email,
          displayName,
          passwordHash: "dummyhash",
          role: "BARBER",
          status: "ACTIVE",
          emailVerifiedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        await barberProfileRepository.provisionProfile({
          id: uuidv7(),
          userId: intendedUserId,
          specialization: null,
        });

        await staffInvitationRepository.consumeInvitation(inv!.id, now);

        // Simulated unexpected failure right before commit
        throw new Error("Simulated failure inside transaction");
      }),
    ).rejects.toThrow("Simulated failure inside transaction");

    // Verify full rollback: user was NOT created
    const userCheck = (await dbClient.db.execute(
      sql`SELECT id FROM users WHERE id = ${intendedUserId}`,
    )) as Array<{ id: string }>;
    expect(userCheck.length).toBe(0);

    // Verify barber profile was NOT created
    const profileCheck = (await dbClient.db.execute(
      sql`SELECT id FROM barber_profiles WHERE user_id = ${intendedUserId}`,
    )) as Array<{ id: string }>;
    expect(profileCheck.length).toBe(0);

    // Verify invitation remained unconsumed (used_at IS NULL)
    const [invCheck] = (await dbClient.db.execute(
      sql`SELECT used_at FROM staff_invitations WHERE id = ${invitationId}`,
    )) as Array<{ used_at: Date | null }>;
    expect(invCheck.used_at).toBeNull();
  });

  it("8. Concurrent acceptance of the same invitation: row lock ensures exactly one succeeds", async () => {
    const rawToken = await tokenPort.generateToken();
    const tokenHash = await tokenPort.hashToken(rawToken);
    const invitationId = uuidv7();
    cleanupInvitationIds.push(invitationId);

    const email = `race-accept-${invitationId.slice(0, 8)}@barberkece.test`;
    const displayName = "Balap Undangan";
    const now = new Date();

    await invitationRepo.createInvitation({
      id: invitationId,
      email,
      displayName,
      role: "BARBER",
      tokenHash,
      expiresAt: new Date(now.getTime() + 48 * 3600 * 1000),
      usedAt: null,
      createdAt: now,
    });

    const acceptUseCase = new AcceptStaffInvitationUseCase(
      runner,
      passwordHashing,
      tokenPort,
    );

    // Concurrently trigger two accept calls with the exact same invitation token
    const results = await Promise.allSettled([
      acceptUseCase.execute({
        token: rawToken,
        passwordRaw: "ConcurrentPasswordA1!",
      }),
      acceptUseCase.execute({
        token: rawToken,
        passwordRaw: "ConcurrentPasswordB2!",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed, exactly one must fail
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const successfulUser = (
      fulfilled[0] as PromiseFulfilledResult<{ user: { id: string } }>
    ).value.user;
    cleanupUserIds.push(successfulUser.id);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(StaffInvitationAlreadyUsedError);

    // Verify in PostgreSQL: exactly one user was created for this email
    const usersInDb = (await dbClient.db.execute(
      sql`SELECT id FROM users WHERE email = ${email}`,
    )) as Array<{ id: string }>;
    expect(usersInDb.length).toBe(1);

    // Verify in PostgreSQL: exactly one barber profile exists
    const profilesInDb = (await dbClient.db.execute(
      sql`SELECT id FROM barber_profiles WHERE user_id = ${successfulUser.id}`,
    )) as Array<{ id: string }>;
    expect(profilesInDb.length).toBe(1);
    cleanupBarberProfileIds.push(profilesInDb[0].id);
  });

  it("9. Foreign-key cascading: deleting user automatically removes linked barber_profile", async () => {
    const rawToken = await tokenPort.generateToken();
    const tokenHash = await tokenPort.hashToken(rawToken);
    const invitationId = uuidv7();
    cleanupInvitationIds.push(invitationId);

    const email = `fk-cascade-${invitationId.slice(0, 8)}@barberkece.test`;
    const displayName = "Cascade Barber";
    const now = new Date();

    await invitationRepo.createInvitation({
      id: invitationId,
      email,
      displayName,
      role: "BARBER",
      tokenHash,
      expiresAt: new Date(now.getTime() + 48 * 3600 * 1000),
      usedAt: null,
      createdAt: now,
    });

    const acceptUseCase = new AcceptStaffInvitationUseCase(
      runner,
      passwordHashing,
      tokenPort,
    );

    const { user } = await acceptUseCase.execute({
      token: rawToken,
      passwordRaw: "PasswordCascade123!",
    });

    // Confirm barber_profile was created
    const [profile] = (await dbClient.db.execute(
      sql`SELECT id FROM barber_profiles WHERE user_id = ${user.id}`,
    )) as Array<{ id: string }>;
    expect(profile).toBeDefined();

    // Delete user from PostgreSQL
    await dbClient.db.delete(users).where(eq(users.id, user.id));

    // Confirm barber_profile was CASCADE deleted by PostgreSQL
    const remainingProfile = (await dbClient.db.execute(
      sql`SELECT id FROM barber_profiles WHERE user_id = ${user.id}`,
    )) as Array<{ id: string }>;
    expect(remainingProfile.length).toBe(0);
  });
});
