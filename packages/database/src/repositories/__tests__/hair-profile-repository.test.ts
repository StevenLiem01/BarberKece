import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgresHairProfileRepository } from "../hair-profile-repository.js";
import { createDatabase, DatabaseClient } from "../../client.js";
import { users, hairProfiles } from "../../schema/index.js";
import { SaveHairProfileInput } from "@barberkece/core/identity";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

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

describe("PostgresHairProfileRepository", () => {
  let dbClient: DatabaseClient;
  let repository: PostgresHairProfileRepository;
  const createdUserIds: string[] = [];
  let testUserId: string;

  beforeAll(async () => {
    dbClient = createDatabase(TEST_DB_URL);
    repository = new PostgresHairProfileRepository(dbClient.db);
    testUserId = uuidv7();
    createdUserIds.push(testUserId);

    await dbClient.db.insert(users).values({
      id: testUserId,
      email: `profile-test-${Date.now()}@example.com`,
      passwordHash: "hash",
      role: "CUSTOMER",
      status: "ACTIVE",
    });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await dbClient.db.delete(users).where(inArray(users.id, createdUserIds));
    }
    await dbClient.close();
  });

  it("returns null if hair profile does not exist", async () => {
    const profile = await repository.getHairProfileByCustomerId(testUserId);
    expect(profile).toBeNull();
  });

  it("creates a new hair profile", async () => {
    const input: SaveHairProfileInput = {
      customerId: testUserId,
      faceShape: "Oval",
      hairType: "Straight",
      hairDensity: "Medium",
      hairLength: "Medium",
      maintenance: "Low",
      styleTags: ["tag1", "tag2"],
    };

    const saved = await repository.saveHairProfile(input);

    expect(saved.customerId).toBe(testUserId);
    expect(saved.faceShape).toBe("Oval");
    expect(saved.hairType).toBe("Straight");
    expect(saved.hairDensity).toBe("Medium");
    expect(saved.hairLength).toBe("Medium");
    expect(saved.maintenance).toBe("Low");
    expect(saved.styleTags).toEqual(["tag1", "tag2"]);
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);

    const fetched = await repository.getHairProfileByCustomerId(testUserId);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(saved.id);
  });

  it("updates an existing hair profile preserving createdAt and updating updatedAt", async () => {
    const initial = await repository.getHairProfileByCustomerId(testUserId);
    expect(initial).not.toBeNull();

    // Sleep 10ms to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 15));

    const input2: SaveHairProfileInput = {
      customerId: testUserId,
      faceShape: "Round",
      hairType: null,
      hairDensity: null,
      hairLength: null,
      maintenance: null,
      styleTags: ["newTag"],
    };
    const updated = await repository.saveHairProfile(input2);

    expect(updated.id).toBe(initial?.id);
    expect(updated.faceShape).toBe("Round");
    expect(updated.hairType).toBeNull();
    expect(updated.hairDensity).toBeNull();
    expect(updated.hairLength).toBeNull();
    expect(updated.maintenance).toBeNull();
    expect(updated.styleTags).toEqual(["newTag"]);
    expect(updated.createdAt.getTime()).toBe(initial?.createdAt.getTime());
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      initial!.updatedAt.getTime(),
    );

    const fetched = await repository.getHairProfileByCustomerId(testUserId);
    expect(fetched?.faceShape).toBe("Round");
    expect(fetched?.hairType).toBeNull();
    expect(fetched?.styleTags).toEqual(["newTag"]);
    expect(fetched?.createdAt.getTime()).toBe(initial?.createdAt.getTime());
  });

  it("handles concurrent first-save for the same customer atomically without duplicate key error", async () => {
    const concurrentUserId = uuidv7();
    createdUserIds.push(concurrentUserId);

    await dbClient.db.insert(users).values({
      id: concurrentUserId,
      email: `concurrent-${Date.now()}@example.com`,
      passwordHash: "hash",
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    const concurrentInputs: SaveHairProfileInput[] = [
      {
        customerId: concurrentUserId,
        faceShape: "Oval",
        hairType: "Straight",
        styleTags: ["TagA"],
      },
      {
        customerId: concurrentUserId,
        faceShape: "Square",
        hairType: "Wavy",
        styleTags: ["TagB"],
      },
      {
        customerId: concurrentUserId,
        faceShape: "Round",
        hairType: "Curly",
        styleTags: ["TagC"],
      },
      {
        customerId: concurrentUserId,
        faceShape: "Diamond",
        hairType: "Coily",
        styleTags: ["TagD"],
      },
    ];

    // Execute concurrent first-saves simultaneously
    const results = await Promise.all(
      concurrentInputs.map((input) => repository.saveHairProfile(input)),
    );

    expect(results).toHaveLength(4);

    // Verify exactly one profile exists for this customer in database
    const rows = await dbClient.db
      .select()
      .from(hairProfiles)
      .where(eq(hairProfiles.customerId, concurrentUserId));

    expect(rows).toHaveLength(1);

    const fetched =
      await repository.getHairProfileByCustomerId(concurrentUserId);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(rows[0].id);
  });
});
