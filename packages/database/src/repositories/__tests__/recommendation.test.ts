import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PostgresHairstyleKnowledgeRepository } from "../recommendation.js";
import { DatabaseClient } from "../../client.js";
import { HairstyleKnowledge } from "@barberkece/core/recommendation";
import {
  hairstyleKnowledge,
  hairstyleCompatibility,
  hairstyleAliases,
} from "../../schema/recommendation/hairstyle_knowledge.js";
import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import {
  createSafeTestDatabaseContext,
  type SafeTestDatabaseContext,
} from "../../testing/index.js";

describe("PostgresHairstyleKnowledgeRepository", () => {
  let safeDb: SafeTestDatabaseContext | undefined;
  let dbClient: DatabaseClient;
  let repository: PostgresHairstyleKnowledgeRepository;

  beforeAll(async () => {
    safeDb = await createSafeTestDatabaseContext();
    dbClient = safeDb.dbClient;
    repository = new PostgresHairstyleKnowledgeRepository(dbClient.db);
  });

  beforeEach(async () => {
    if (safeDb?.isVerified) {
      await safeDb.safeCleanup(async () => {
        await dbClient.db.delete(hairstyleKnowledge);
      });
    }
  });

  afterAll(async () => {
    if (safeDb?.isVerified) {
      await safeDb.safeCleanup(async () => {
        await dbClient.db.delete(hairstyleKnowledge);
      });
      await safeDb.close();
    }
  });

  const getValidFixture = (): HairstyleKnowledge => ({
    id: uuidv7(),
    name: `Classic Taper - ${uuidv7()}`,
    aliases: ["Taper", "Classic"],
    shortDescription: "A timeless haircut",
    longDescription: "A timeless haircut that looks good on anyone.",
    virtualFilterAssetRef: "taper_asset_001",
    minimumHairLength: "Medium",
    recommendedHairLength: "Medium",
    maintenanceLevel: "Low",
    stylingDifficulty: "Low",
    styleTags: ["Classic", "Clean"],
    professionalNotes: "Easy to cut.",
    commonMistakes: "Cutting too high.",
    recommendedProductsPlaceholder: "Pomade",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    previewImages: [
      { url: "https://example.com/taper1.jpg", displayOrder: 1 },
      { url: "https://example.com/taper2.jpg", displayOrder: 2 },
    ],
    compatibility: {
      faceShape: {
        Oval: 1.0,
        Round: 0.75,
      },
      hairType: {
        Straight: 1.0,
        Wavy: 0.5,
      },
      hairDensity: {
        Medium: 1.0,
      },
    },
  });

  it("should create and find a hairstyle knowledge entry", async () => {
    const fixture = getValidFixture();
    await repository.save(fixture);

    const found = await repository.findById(fixture.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe(fixture.name);
    expect(found?.aliases).toHaveLength(2);
    expect(found?.previewImages).toHaveLength(2);
    expect(found?.styleTags).toHaveLength(2);
    expect(found?.compatibility.faceShape?.Oval).toBe(1.0);
    expect(found?.compatibility.faceShape?.Round).toBe(0.75);
    expect(found?.compatibility.hairType?.Straight).toBe(1.0);
    expect(found?.compatibility.hairType?.Wavy).toBe(0.5);
    expect(found?.compatibility.hairDensity?.Medium).toBe(1.0);
  });

  it("should update an existing hairstyle knowledge entry", async () => {
    const fixture = getValidFixture();
    await repository.save(fixture);

    fixture.name = `Updated Taper - ${uuidv7()}`;
    fixture.aliases = ["New Taper"];
    fixture.styleTags = ["Modern"];
    fixture.compatibility.faceShape = { Square: 0.5 };
    fixture.compatibility.hairType = {};
    fixture.compatibility.hairDensity = { "Thick / High Density": 0.75 };

    await repository.update(fixture);

    const found = await repository.findById(fixture.id);
    expect(found?.name).toBe(fixture.name);
    expect(found?.aliases).toEqual(["New Taper"]);
    expect(found?.styleTags).toEqual(["Modern"]);
    expect(found?.compatibility.faceShape?.Square).toBe(0.5);
    expect(found?.compatibility.faceShape?.Oval).toBeUndefined();
    expect(found?.compatibility.hairType?.Straight).toBeUndefined();
    expect(found?.compatibility.hairDensity?.["Thick / High Density"]).toBe(
      0.75,
    );
  });

  it("should deactivate an entry without deleting it", async () => {
    const fixture = getValidFixture();
    await repository.save(fixture);

    await repository.deactivate(fixture.id);

    const found = await repository.findById(fixture.id);
    expect(found).not.toBeNull();
    expect(found?.isActive).toBe(false);
  });

  it("should return null for non-existent id", async () => {
    const found = await repository.findById(uuidv7());
    expect(found).toBeNull();
  });

  it("should retrieve exact count in findAll and include deactivated entries", async () => {
    const fixture1 = getValidFixture();
    const fixture2 = getValidFixture();

    await repository.save(fixture1);
    await repository.save(fixture2);

    let all = await repository.findAll();
    expect(all).toHaveLength(2);

    await repository.deactivate(fixture1.id);

    all = await repository.findAll();
    expect(all).toHaveLength(2);
    const deactivated = all.find((k) => k.id === fixture1.id);
    expect(deactivated?.isActive).toBe(false);
    const active = all.find((k) => k.id === fixture2.id);
    expect(active?.isActive).toBe(true);
  });

  it("should reject invalid compatibility score via DB check constraint", async () => {
    const fixture = getValidFixture();
    await repository.save(fixture);

    await expect(
      dbClient.db.insert(hairstyleCompatibility).values({
        hairstyleId: fixture.id,
        attributeType: "face_shape",
        attributeValue: "Square",
        compatibilityScore: "0.33",
      }),
    ).rejects.toThrow();
  });

  it("should reject invalid attribute_type via DB check constraint", async () => {
    const fixture = getValidFixture();
    await repository.save(fixture);

    await expect(
      dbClient.db.insert(hairstyleCompatibility).values({
        hairstyleId: fixture.id,
        attributeType: "eye_colour",
        attributeValue: "Brown",
        compatibilityScore: "1.00",
      }),
    ).rejects.toThrow();
  });

  it("should reject invalid taxonomy values via DB check constraints", async () => {
    const baseFixture = {
      shortDescription: "Desc",
      longDescription: "Long Desc",
      minimumHairLength: "Medium",
      recommendedHairLength: "Medium",
      maintenanceLevel: "Low",
      stylingDifficulty: "Low",
      isActive: true,
    };

    await expect(
      dbClient.db.insert(hairstyleKnowledge).values({
        ...baseFixture,
        id: uuidv7(),
        name: `Taxonomy Test 1 - ${uuidv7()}`,
        minimumHairLength: "Bald",
      }),
    ).rejects.toThrow();

    await expect(
      dbClient.db.insert(hairstyleKnowledge).values({
        ...baseFixture,
        id: uuidv7(),
        name: `Taxonomy Test 2 - ${uuidv7()}`,
        recommendedHairLength: "Shaved",
      }),
    ).rejects.toThrow();

    await expect(
      dbClient.db.insert(hairstyleKnowledge).values({
        ...baseFixture,
        id: uuidv7(),
        name: `Taxonomy Test 3 - ${uuidv7()}`,
        maintenanceLevel: "Extreme",
      }),
    ).rejects.toThrow();

    await expect(
      dbClient.db.insert(hairstyleKnowledge).values({
        ...baseFixture,
        id: uuidv7(),
        name: `Taxonomy Test 4 - ${uuidv7()}`,
        stylingDifficulty: "Impossible",
      }),
    ).rejects.toThrow();
  });

  it("should roll back parent hairstyle_knowledge if child insert fails", async () => {
    const fixture = getValidFixture();
    // Provide duplicate aliases which violates hairstyle_aliases_hairstyle_id_alias_unique
    fixture.aliases = ["DuplicateAlias", "DuplicateAlias"];

    await expect(repository.save(fixture)).rejects.toThrow();

    const found = await repository.findById(fixture.id);
    expect(found).toBeNull();

    const rows = await dbClient.db
      .select()
      .from(hairstyleKnowledge)
      .where(eq(hairstyleKnowledge.id, fixture.id));
    expect(rows).toHaveLength(0);
  });

  it("should preserve deterministic preview image ordering by displayOrder", async () => {
    const fixture = getValidFixture();
    fixture.previewImages = [
      { url: "https://example.com/img3.jpg", displayOrder: 3 },
      { url: "https://example.com/img1.jpg", displayOrder: 1 },
      { url: "https://example.com/img2.jpg", displayOrder: 2 },
    ];

    await repository.save(fixture);

    const found = await repository.findById(fixture.id);
    expect(found).not.toBeNull();
    expect(found?.previewImages).toEqual([
      { url: "https://example.com/img1.jpg", displayOrder: 1 },
      { url: "https://example.com/img2.jpg", displayOrder: 2 },
      { url: "https://example.com/img3.jpg", displayOrder: 3 },
    ]);

    const all = await repository.findAll();
    const foundInAll = all.find((k) => k.id === fixture.id);
    expect(foundInAll?.previewImages).toEqual([
      { url: "https://example.com/img1.jpg", displayOrder: 1 },
      { url: "https://example.com/img2.jpg", displayOrder: 2 },
      { url: "https://example.com/img3.jpg", displayOrder: 3 },
    ]);
  });

  it("should preserve deterministic alias and style tag ordering", async () => {
    const fixture = getValidFixture();
    fixture.aliases = ["Zeta", "Alpha", "Beta"];
    fixture.styleTags = ["Urban", "Classic", "Modern"];

    await repository.save(fixture);

    const found = await repository.findById(fixture.id);
    expect(found).not.toBeNull();
    expect(found?.aliases).toEqual(["Alpha", "Beta", "Zeta"]);
    expect(found?.styleTags).toEqual(["Classic", "Modern", "Urban"]);

    const all = await repository.findAll();
    const foundInAll = all.find((k) => k.id === fixture.id);
    expect(foundInAll?.aliases).toEqual(["Alpha", "Beta", "Zeta"]);
    expect(foundInAll?.styleTags).toEqual(["Classic", "Modern", "Urban"]);
  });

  it("should reject duplicate display_order for the same hairstyle", async () => {
    const fixture = getValidFixture();
    fixture.previewImages = [
      { url: "https://example.com/a.jpg", displayOrder: 1 },
      { url: "https://example.com/b.jpg", displayOrder: 1 },
    ];

    await expect(repository.save(fixture)).rejects.toThrow();
  });

  it("should reject duplicate alias for the same hairstyle", async () => {
    const fixture = getValidFixture();
    await repository.save(fixture);

    await expect(
      dbClient.db.insert(hairstyleAliases).values({
        hairstyleId: fixture.id,
        alias: fixture.aliases[0]!,
      }),
    ).rejects.toThrow();
  });

  it("should use server-owned createdAt and updatedAt timestamps on save", async () => {
    const pastDate = new Date("2020-01-01T00:00:00Z");
    const fixture = getValidFixture();
    fixture.createdAt = pastDate;
    fixture.updatedAt = pastDate;

    await repository.save(fixture);

    const found = await repository.findById(fixture.id);
    expect(found).not.toBeNull();
    expect(found?.createdAt.getTime()).toBeGreaterThan(pastDate.getTime());
    expect(found?.updatedAt.getTime()).toBeGreaterThan(pastDate.getTime());
  });
  it("should reject hair_thickness as attribute_type after migration 0010", async () => {
    // Post-migration: the CHECK constraint now allows only 'face_shape', 'hair_type', 'hair_density'.
    // 'hair_thickness' must be rejected.
    const fixture = getValidFixture();
    await repository.save(fixture);

    await expect(
      dbClient.db.insert(hairstyleCompatibility).values({
        hairstyleId: fixture.id,
        // 'hair_thickness' is a valid string but violates the DB CHECK constraint post-migration.
        attributeType: "hair_thickness",
        attributeValue: "Medium",
        compatibilityScore: "1.00",
      }),
    ).rejects.toThrow();
  });

  it("should hydrate hair_density rows correctly from the database", async () => {
    // This test verifies that the repository correctly reads and hydrates hair_density rows.
    const fixture = getValidFixture();
    // Remove hairDensity from the fixture so no compatibility rows are inserted by the repo.
    fixture.compatibility = {};
    await repository.save(fixture);

    // Insert manually bypassing the repo to ensure hydration logic works.
    await dbClient.db.execute(
      sql`INSERT INTO hairstyle_compatibility (hairstyle_id, attribute_type, attribute_value, compatibility_score)
          VALUES (${fixture.id}, 'hair_density', 'Medium', 1.00)`,
    );

    const found = await repository.findById(fixture.id);
    expect(found).not.toBeNull();
    expect(found?.compatibility.hairDensity?.Medium).toBe(1.0);
    expect(found?.compatibility.hairDensity).toEqual({ Medium: 1.0 });
  });

  it("should convert legacy hair_thickness rows to hair_density (migration 0010 SQL test)", async () => {
    // 1. Create a disposable isolated test environment (temporary schema)
    await dbClient.db
      .transaction(async (tx) => {
        // Isolate to this transaction only
        await tx.execute(sql`CREATE SCHEMA f02_test`);
        await tx.execute(sql`SET LOCAL search_path TO f02_test`);

        // Create the table precisely as it existed BEFORE migration 0010
        await tx.execute(sql`
        CREATE TABLE "hairstyle_compatibility" (
          "hairstyle_id" uuid NOT NULL,
          "attribute_type" text NOT NULL,
          "attribute_value" text NOT NULL,
          "compatibility_score" numeric(4, 3) NOT NULL
        )
      `);
        await tx.execute(sql`
        ALTER TABLE "hairstyle_compatibility" ADD CONSTRAINT "hairstyle_compatibility_attribute_type_check" 
        CHECK ("attribute_type" IN ('face_shape', 'hair_type', 'hair_thickness'))
      `);

        // 2. Insert a real legacy row using 'hair_thickness'
        // Use a dummy UUID since there is no foreign key in our disposable schema
        const dummyId = "00000000-0000-0000-0000-000000000000";
        await tx.execute(
          sql`INSERT INTO "hairstyle_compatibility" ("hairstyle_id", "attribute_type", "attribute_value", "compatibility_score")
            VALUES (${dummyId}, 'hair_thickness', 'Medium', 1.00)`,
        );

        // 3. Apply migration 0010 EXACTLY as written in the SQL file
        const currentDir = dirname(fileURLToPath(import.meta.url));
        const migrationPath = resolve(
          currentDir,
          "../../../migrations/0010_standardize_hair_density.sql",
        );
        const migrationSql = readFileSync(migrationPath, "utf-8");

        const statements = migrationSql
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter(Boolean);

        for (const stmt of statements) {
          await tx.execute(sql.raw(stmt));
        }

        // 4. Assert that the row was converted correctly
        const result = await tx.execute(
          sql`SELECT * FROM "hairstyle_compatibility"`,
        );
        expect(result).toHaveLength(1);

        // Typecasting row to match what postgres.js / drizzle returns dynamically
        const row = result[0] as {
          attribute_type: string;
          compatibility_score: string;
        };
        expect(row.attribute_type).toBe("hair_density");
        // Assert the compatibility score is unchanged (postgres numeric returns as string in some drivers, so we cast to Number)
        expect(Number(row.compatibility_score)).toBe(1.0);

        // 5. Confirm that hair_thickness is rejected after migration
        await expect(
          tx.execute(
            sql`INSERT INTO "hairstyle_compatibility" ("hairstyle_id", "attribute_type", "attribute_value", "compatibility_score")
              VALUES (${dummyId}, 'hair_thickness', 'Thick', 0.50)`,
          ),
        ).rejects.toThrow();

        // Rollback to destroy the temporary schema and leave the database clean
        tx.rollback();
      })
      .catch((err: unknown) => {
        // Drizzle throws when tx.rollback() is called. We expect this throw.
        if (err instanceof Error && err.message !== "Rollback") {
          throw err;
        }
      });
  });
});
