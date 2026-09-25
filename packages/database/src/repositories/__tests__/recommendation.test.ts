import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PostgresHairstyleKnowledgeRepository } from "../recommendation.js";
import { DatabaseClient } from "../../client.js";
import { HairstyleKnowledge } from "@barberkece/core/recommendation";
import {
  hairstyleKnowledge,
  hairstyleCompatibility,
  hairstyleAliases,
} from "../../schema/recommendation/hairstyle_knowledge.js";
import { eq } from "drizzle-orm";
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
      hairThickness: {
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
    expect(found?.compatibility.hairThickness?.Medium).toBe(1.0);
  });

  it("should update an existing hairstyle knowledge entry", async () => {
    const fixture = getValidFixture();
    await repository.save(fixture);

    fixture.name = `Updated Taper - ${uuidv7()}`;
    fixture.aliases = ["New Taper"];
    fixture.styleTags = ["Modern"];
    fixture.compatibility.faceShape = { Square: 0.5 };
    fixture.compatibility.hairType = {};
    fixture.compatibility.hairThickness = { "Thick / High Density": 0.75 };

    await repository.update(fixture);

    const found = await repository.findById(fixture.id);
    expect(found?.name).toBe(fixture.name);
    expect(found?.aliases).toEqual(["New Taper"]);
    expect(found?.styleTags).toEqual(["Modern"]);
    expect(found?.compatibility.faceShape?.Square).toBe(0.5);
    expect(found?.compatibility.faceShape?.Oval).toBeUndefined();
    expect(found?.compatibility.hairType?.Straight).toBeUndefined();
    expect(found?.compatibility.hairThickness?.["Thick / High Density"]).toBe(
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
});
