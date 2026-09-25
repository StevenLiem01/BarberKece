import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { DatabaseClient } from "../../../client.js";
import { PostgresServiceRepository } from "../service-repository.js";
import { services } from "../../../schema/reservation/services.js";
import {
  createSafeTestDatabaseContext,
  type SafeTestDatabaseContext,
} from "../../../testing/index.js";

describe("PostgresServiceRepository", () => {
  let safeDb: SafeTestDatabaseContext | undefined;
  let dbClient: DatabaseClient;
  let repository: PostgresServiceRepository;
  const testIds: string[] = [];

  beforeAll(async () => {
    safeDb = await createSafeTestDatabaseContext();
    dbClient = safeDb.dbClient;
    repository = new PostgresServiceRepository(dbClient.db);
  });

  afterAll(async () => {
    if (safeDb?.isVerified) {
      await safeDb.safeCleanup(async () => {
        for (const id of testIds) {
          await dbClient.db.delete(services).where(eq(services.id, id));
        }
      });
      await safeDb.close();
    }
  });

  it("should create a service", async () => {
    const id = uuidv7();
    testIds.push(id);

    const service = await repository.createService({
      id,
      name: "Haircut",
      description: "Standard haircut",
      durationMinutes: 30,
      priceRupiah: 50000,
      isActive: true,
    });

    expect(service.id).toBe(id);
    expect(service.name).toBe("Haircut");
    expect(service.durationMinutes).toBe(30);
    expect(service.priceRupiah).toBe(50000);
    expect(service.isActive).toBe(true);
  });

  it("should update a service", async () => {
    const id = uuidv7();
    testIds.push(id);

    await repository.createService({
      id,
      name: "Old Name",
      description: null,
      durationMinutes: 30,
      priceRupiah: 50000,
    });

    const updated = await repository.updateService(id, {
      name: "New Name",
      durationMinutes: 45,
    });

    expect(updated.name).toBe("New Name");
    expect(updated.durationMinutes).toBe(45);
    expect(updated.priceRupiah).toBe(50000);
  });

  it("should toggle service status", async () => {
    const id = uuidv7();
    testIds.push(id);

    await repository.createService({
      id,
      name: "Service Status Test",
      description: null,
      durationMinutes: 30,
      priceRupiah: 50000,
      isActive: true,
    });

    const deactivated = await repository.updateServiceStatus(id, false);
    expect(deactivated.isActive).toBe(false);

    const activated = await repository.updateServiceStatus(id, true);
    expect(activated.isActive).toBe(true);
  });

  it("should find service by id", async () => {
    const id = uuidv7();
    testIds.push(id);

    await repository.createService({
      id,
      name: "Find Me",
      description: null,
      durationMinutes: 30,
      priceRupiah: 50000,
    });

    const found = await repository.findById(id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(id);
  });

  it("should fail constraint when duration is zero", async () => {
    const id = uuidv7();
    testIds.push(id);

    await expect(
      repository.createService({
        id,
        name: "Invalid",
        description: null,
        durationMinutes: 0,
        priceRupiah: 50000,
      }),
    ).rejects.toThrow();
  });

  it("findActive should return active services and exclude inactive ones", async () => {
    const activeId = uuidv7();
    const inactiveId = uuidv7();
    testIds.push(activeId);
    testIds.push(inactiveId);

    await repository.createService({
      id: activeId,
      name: "Active Service",
      description: null,
      durationMinutes: 30,
      priceRupiah: 50000,
      isActive: true,
    });

    await repository.createService({
      id: inactiveId,
      name: "Inactive Service",
      description: null,
      durationMinutes: 30,
      priceRupiah: 50000,
      isActive: false,
    });

    const active = await repository.findActive();
    const activeIds = active.map((s) => s.id);

    expect(activeIds).toContain(activeId);
    expect(activeIds).not.toContain(inactiveId);
  });
});
