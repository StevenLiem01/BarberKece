import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { DatabaseClient } from "../../../client.js";
import { PostgresBarberEligibilityRepository } from "../barber-eligibility-repository.js";
import { barberProfiles } from "../../../schema/barber/barber_profiles.js";
import { services } from "../../../schema/reservation/services.js";
import { users } from "../../../schema/identity/users.js";
import {
  createSafeTestDatabaseContext,
  type SafeTestDatabaseContext,
} from "../../../testing/index.js";

describe("PostgresBarberEligibilityRepository", () => {
  let safeDb: SafeTestDatabaseContext | undefined;
  let dbClient: DatabaseClient;
  let repository: PostgresBarberEligibilityRepository;
  const testUserIds: string[] = [];
  const testProfileIds: string[] = [];
  const testServiceIds: string[] = [];

  beforeAll(async () => {
    safeDb = await createSafeTestDatabaseContext();
    dbClient = safeDb.dbClient;
    repository = new PostgresBarberEligibilityRepository(dbClient.db);
  });

  afterAll(async () => {
    if (safeDb?.isVerified) {
      await safeDb.safeCleanup(async () => {
        for (const id of testProfileIds) {
          await dbClient.db.delete(barberProfiles).where(eq(barberProfiles.id, id));
        }
        for (const id of testServiceIds) {
          await dbClient.db.delete(services).where(eq(services.id, id));
        }
        for (const id of testUserIds) {
          await dbClient.db.delete(users).where(eq(users.id, id));
        }
      });
      await safeDb.close();
    }
  });

  async function createTestBarber() {
    const userId = uuidv7();
    const profileId = uuidv7();
    testUserIds.push(userId);
    testProfileIds.push(profileId);

    await dbClient.db.insert(users).values({
      id: userId,
      email: `test-barber-el-${userId}@example.com`,
      passwordHash: "dummy",
      role: "BARBER",
      status: "ACTIVE",
    });

    await dbClient.db.insert(barberProfiles).values({
      id: profileId,
      userId,
    });

    return profileId;
  }

  async function createTestService(name: string) {
    const id = uuidv7();
    testServiceIds.push(id);
    await dbClient.db.insert(services).values({
      id,
      name,
      durationMinutes: 30,
      priceRupiah: 50000,
    });
    return id;
  }

  it("should assign and remove services", async () => {
    const barberId = await createTestBarber();
    const service1 = await createTestService("Service A");
    const service2 = await createTestService("Service B");

    // Assign
    await repository.assignService(barberId, service1);
    await repository.assignService(barberId, service2);

    let eligible = await repository.findServicesByBarberId(barberId);
    expect(eligible.length).toBe(2);
    expect(eligible.map((s) => s.id)).toContain(service1);
    expect(eligible.map((s) => s.id)).toContain(service2);

    // Remove
    await repository.removeService(barberId, service1);
    eligible = await repository.findServicesByBarberId(barberId);
    expect(eligible.length).toBe(1);
    expect(eligible[0]?.id).toBe(service2);
  });

  it("should handle duplicate assignment gracefully", async () => {
    const barberId = await createTestBarber();
    const service = await createTestService("Service C");

    await repository.assignService(barberId, service);
    await repository.assignService(barberId, service); // should not throw

    const eligible = await repository.findServicesByBarberId(barberId);
    expect(eligible.length).toBe(1);
  });

  it("should check eligibility accurately with isEligible", async () => {
    const barberId = await createTestBarber();
    const service1 = await createTestService("Service Eligibility 1");
    const service2 = await createTestService("Service Eligibility 2");

    expect(await repository.isEligible(barberId, service1)).toBe(false);

    await repository.assignService(barberId, service1);
    expect(await repository.isEligible(barberId, service1)).toBe(true);
    expect(await repository.isEligible(barberId, service2)).toBe(false);

    await repository.removeService(barberId, service1);
    expect(await repository.isEligible(barberId, service1)).toBe(false);
  });

  it("should return eligible barber profile IDs deterministically ordered", async () => {
    const barber1 = await createTestBarber();
    const barber2 = await createTestBarber();
    const service = await createTestService("Service Multi-Barber");

    // Initially no barbers eligible
    expect(await repository.findEligibleBarberProfileIds(service)).toEqual([]);

    await repository.assignService(barber1, service);
    await repository.assignService(barber2, service);

    const eligibleIds = await repository.findEligibleBarberProfileIds(service);
    expect(eligibleIds).toHaveLength(2);
    expect(eligibleIds).toContain(barber1);
    expect(eligibleIds).toContain(barber2);

    // Verify deterministic ordering: sorted by barberProfileId ascending
    const expectedOrder = [barber1, barber2].sort();
    expect(eligibleIds).toEqual(expectedOrder);
  });
});
