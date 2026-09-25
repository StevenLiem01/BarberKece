import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { DatabaseClient } from "../../../client.js";
import { PostgresBarberProfileRepository } from "../barber-profile-repository.js";
import { barberProfiles } from "../../../schema/barber/barber_profiles.js";
import { users } from "../../../schema/identity/users.js";
import { BarberProfileAlreadyExistsError } from "@barberkece/core/barber";
import {
  createSafeTestDatabaseContext,
  type SafeTestDatabaseContext,
} from "../../../testing/index.js";

describe("PostgresBarberProfileRepository", () => {
  let safeDb: SafeTestDatabaseContext | undefined;
  let dbClient: DatabaseClient;
  let repository: PostgresBarberProfileRepository;
  const testUserIds: string[] = [];
  const testProfileIds: string[] = [];

  beforeAll(async () => {
    safeDb = await createSafeTestDatabaseContext();
    dbClient = safeDb.dbClient;
    repository = new PostgresBarberProfileRepository(dbClient.db);
  });

  afterAll(async () => {
    if (safeDb?.isVerified) {
      await safeDb.safeCleanup(async () => {
        for (const id of testProfileIds) {
          await dbClient.db.delete(barberProfiles).where(eq(barberProfiles.id, id));
        }
        for (const id of testUserIds) {
          await dbClient.db.delete(users).where(eq(users.id, id));
        }
      });
      await safeDb.close();
    }
  });

  async function createTestUser() {
    const id = uuidv7();
    testUserIds.push(id);
    await dbClient.db.insert(users).values({
      id,
      email: `test-barber-${id}@example.com`,
      passwordHash: "dummy",
      role: "BARBER",
      status: "ACTIVE",
    });
    return id;
  }

  it("should provision a barber profile", async () => {
    const userId = await createTestUser();
    const id = uuidv7();
    testProfileIds.push(id);

    const profile = await repository.provisionProfile({
      id,
      userId,
      specialization: "Fade",
    });

    expect(profile.id).toBe(id);
    expect(profile.userId).toBe(userId);
    expect(profile.specialization).toBe("Fade");
  });

  it("should update specialization", async () => {
    const userId = await createTestUser();
    const id = uuidv7();
    testProfileIds.push(id);

    await repository.provisionProfile({
      id,
      userId,
      specialization: "Old Spec",
    });

    const updated = await repository.updateSpecialization(id, "New Spec");
    expect(updated.specialization).toBe("New Spec");
  });

  it("should find by user id", async () => {
    const userId = await createTestUser();
    const id = uuidv7();
    testProfileIds.push(id);

    await repository.provisionProfile({
      id,
      userId,
      specialization: "Find Me",
    });

    const found = await repository.findByUserId(userId);
    expect(found).not.toBeNull();
    expect(found?.userId).toBe(userId);

    // findById - LOW priority coverage, fits naturally here
    const byId = await repository.findById(id);
    expect(byId).not.toBeNull();
    expect(byId?.id).toBe(id);
  });

  it("should reject a second profile for the same user (unique user_id constraint) with BarberProfileAlreadyExistsError", async () => {
    const userId = await createTestUser();
    const id1 = uuidv7();
    const id2 = uuidv7();
    testProfileIds.push(id1);
    // id2 is registered for cleanup even though insert should fail,
    // to be safe in case the constraint is somehow not enforced.
    testProfileIds.push(id2);

    await repository.provisionProfile({ id: id1, userId });

    await expect(
      repository.provisionProfile({ id: id2, userId }),
    ).rejects.toThrow(BarberProfileAlreadyExistsError);
  });
});
