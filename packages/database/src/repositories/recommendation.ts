import { eq, inArray, asc } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import {
  hairstyleKnowledge,
  hairstyleAliases,
  hairstylePreviewImages,
  hairstyleStyleTags,
  hairstyleCompatibility,
} from "../schema/recommendation/hairstyle_knowledge.js";
import {
  HairstyleKnowledge,
  HairstyleKnowledgeRepository,
  FaceShape,
  HairType,
  HairDensity,
  HairLength,
  MaintenanceLevel,
  StylingDifficulty,
  CompatibilityScore,
} from "@barberkece/core/recommendation";

const VALID_HAIR_LENGTHS: readonly HairLength[] = [
  "Very Short",
  "Short",
  "Medium",
  "Long",
] as const;

const VALID_MAINTENANCE_LEVELS: readonly MaintenanceLevel[] = [
  "Very Low",
  "Low",
  "Medium",
  "High",
] as const;

const VALID_STYLING_DIFFICULTIES: readonly StylingDifficulty[] = [
  "Low",
  "Medium",
  "High",
] as const;

const VALID_COMPATIBILITY_SCORES: readonly CompatibilityScore[] = [
  0.0, 0.5, 0.75, 1.0,
] as const;

function isHairLength(val: string): val is HairLength {
  return (VALID_HAIR_LENGTHS as readonly string[]).includes(val);
}

function isMaintenanceLevel(val: string): val is MaintenanceLevel {
  return (VALID_MAINTENANCE_LEVELS as readonly string[]).includes(val);
}

function isStylingDifficulty(val: string): val is StylingDifficulty {
  return (VALID_STYLING_DIFFICULTIES as readonly string[]).includes(val);
}

function isCompatibilityScore(val: number): val is CompatibilityScore {
  return (VALID_COMPATIBILITY_SCORES as readonly number[]).includes(val);
}

interface CompatibilityRowInsert {
  hairstyleId: string;
  attributeType: "face_shape" | "hair_type" | "hair_density";
  attributeValue: string;
  compatibilityScore: string;
}

function buildCompatibilityRows(
  hairstyleId: string,
  compatibility: HairstyleKnowledge["compatibility"],
): CompatibilityRowInsert[] {
  const compRows: CompatibilityRowInsert[] = [];
  if (compatibility.faceShape) {
    for (const [val, score] of Object.entries(compatibility.faceShape)) {
      if (score !== undefined) {
        compRows.push({
          hairstyleId,
          attributeType: "face_shape",
          attributeValue: val,
          compatibilityScore: score.toFixed(2),
        });
      }
    }
  }
  if (compatibility.hairType) {
    for (const [val, score] of Object.entries(compatibility.hairType)) {
      if (score !== undefined) {
        compRows.push({
          hairstyleId,
          attributeType: "hair_type",
          attributeValue: val,
          compatibilityScore: score.toFixed(2),
        });
      }
    }
  }
  if (compatibility.hairDensity) {
    for (const [val, score] of Object.entries(compatibility.hairDensity)) {
      if (score !== undefined) {
        compRows.push({
          hairstyleId,
          attributeType: "hair_density",
          attributeValue: val,
          compatibilityScore: score.toFixed(2),
        });
      }
    }
  }
  return compRows;
}

function hydrateHairstyleKnowledge(
  hk: typeof hairstyleKnowledge.$inferSelect,
  aliases: string[],
  previewImages: { url: string; displayOrder: number }[],
  styleTags: string[],
  compatibilityRows: Array<{
    attributeType: string;
    attributeValue: string;
    compatibilityScore: string;
  }>,
): HairstyleKnowledge {
  if (!isHairLength(hk.minimumHairLength)) {
    throw new Error(`Invalid minimum hair length: ${hk.minimumHairLength}`);
  }
  if (!isHairLength(hk.recommendedHairLength)) {
    throw new Error(
      `Invalid recommended hair length: ${hk.recommendedHairLength}`,
    );
  }
  if (!isMaintenanceLevel(hk.maintenanceLevel)) {
    throw new Error(`Invalid maintenance level: ${hk.maintenanceLevel}`);
  }
  if (!isStylingDifficulty(hk.stylingDifficulty)) {
    throw new Error(`Invalid styling difficulty: ${hk.stylingDifficulty}`);
  }

  const compatibility: HairstyleKnowledge["compatibility"] = {
    faceShape: {},
    hairType: {},
    hairDensity: {},
  };

  for (const row of compatibilityRows) {
    const score = Number(row.compatibilityScore);
    if (!isCompatibilityScore(score)) {
      throw new Error(
        `Invalid compatibility score in database: ${row.compatibilityScore}`,
      );
    }
    if (row.attributeType === "face_shape") {
      if (!compatibility.faceShape) compatibility.faceShape = {};
      compatibility.faceShape[row.attributeValue as FaceShape] = score;
    } else if (row.attributeType === "hair_type") {
      if (!compatibility.hairType) compatibility.hairType = {};
      compatibility.hairType[row.attributeValue as HairType] = score;
    } else if (row.attributeType === "hair_density") {
      if (!compatibility.hairDensity) compatibility.hairDensity = {};
      compatibility.hairDensity[row.attributeValue as HairDensity] = score;
    }
  }

  return {
    id: hk.id,
    name: hk.name,
    shortDescription: hk.shortDescription,
    longDescription: hk.longDescription,
    virtualFilterAssetRef: hk.virtualFilterAssetRef,
    minimumHairLength: hk.minimumHairLength,
    recommendedHairLength: hk.recommendedHairLength,
    maintenanceLevel: hk.maintenanceLevel,
    stylingDifficulty: hk.stylingDifficulty,
    professionalNotes: hk.professionalNotes,
    commonMistakes: hk.commonMistakes,
    recommendedProductsPlaceholder: hk.recommendedProductsPlaceholder,
    isActive: hk.isActive,
    createdAt: hk.createdAt,
    updatedAt: hk.updatedAt,
    aliases,
    previewImages,
    styleTags,
    compatibility,
  };
}

export class PostgresHairstyleKnowledgeRepository implements HairstyleKnowledgeRepository {
  constructor(private readonly db: DbOrTx) {}

  async findById(id: string): Promise<HairstyleKnowledge | null> {
    const knowledgeResult = await this.db
      .select()
      .from(hairstyleKnowledge)
      .where(eq(hairstyleKnowledge.id, id))
      .limit(1);

    if (knowledgeResult.length === 0) {
      return null;
    }

    const hk = knowledgeResult[0];

    const [aliasesResult, imagesResult, tagsResult, compatibilityResult] =
      await Promise.all([
        this.db
          .select({ alias: hairstyleAliases.alias })
          .from(hairstyleAliases)
          .where(eq(hairstyleAliases.hairstyleId, id))
          .orderBy(asc(hairstyleAliases.alias)),
        this.db
          .select({
            url: hairstylePreviewImages.url,
            displayOrder: hairstylePreviewImages.displayOrder,
          })
          .from(hairstylePreviewImages)
          .where(eq(hairstylePreviewImages.hairstyleId, id))
          .orderBy(asc(hairstylePreviewImages.displayOrder)),
        this.db
          .select({ tag: hairstyleStyleTags.tag })
          .from(hairstyleStyleTags)
          .where(eq(hairstyleStyleTags.hairstyleId, id))
          .orderBy(asc(hairstyleStyleTags.tag)),
        this.db
          .select({
            attributeType: hairstyleCompatibility.attributeType,
            attributeValue: hairstyleCompatibility.attributeValue,
            compatibilityScore: hairstyleCompatibility.compatibilityScore,
          })
          .from(hairstyleCompatibility)
          .where(eq(hairstyleCompatibility.hairstyleId, id)),
      ]);

    return hydrateHairstyleKnowledge(
      hk,
      aliasesResult.map((r) => r.alias),
      imagesResult.map((r) => ({ url: r.url, displayOrder: r.displayOrder })),
      tagsResult.map((r) => r.tag),
      compatibilityResult,
    );
  }

  async findAll(): Promise<HairstyleKnowledge[]> {
    const knowledgeList = await this.db
      .select()
      .from(hairstyleKnowledge)
      .orderBy(asc(hairstyleKnowledge.name), asc(hairstyleKnowledge.id));

    if (knowledgeList.length === 0) {
      return [];
    }

    const ids = knowledgeList.map((k) => k.id);

    const [allAliases, allImages, allTags, allCompat] = await Promise.all([
      this.db
        .select({
          hairstyleId: hairstyleAliases.hairstyleId,
          alias: hairstyleAliases.alias,
        })
        .from(hairstyleAliases)
        .where(inArray(hairstyleAliases.hairstyleId, ids))
        .orderBy(asc(hairstyleAliases.alias)),
      this.db
        .select({
          hairstyleId: hairstylePreviewImages.hairstyleId,
          url: hairstylePreviewImages.url,
          displayOrder: hairstylePreviewImages.displayOrder,
        })
        .from(hairstylePreviewImages)
        .where(inArray(hairstylePreviewImages.hairstyleId, ids))
        .orderBy(asc(hairstylePreviewImages.displayOrder)),
      this.db
        .select({
          hairstyleId: hairstyleStyleTags.hairstyleId,
          tag: hairstyleStyleTags.tag,
        })
        .from(hairstyleStyleTags)
        .where(inArray(hairstyleStyleTags.hairstyleId, ids))
        .orderBy(asc(hairstyleStyleTags.tag)),
      this.db
        .select({
          hairstyleId: hairstyleCompatibility.hairstyleId,
          attributeType: hairstyleCompatibility.attributeType,
          attributeValue: hairstyleCompatibility.attributeValue,
          compatibilityScore: hairstyleCompatibility.compatibilityScore,
        })
        .from(hairstyleCompatibility)
        .where(inArray(hairstyleCompatibility.hairstyleId, ids)),
    ]);

    const aliasesByHairstyleId = new Map<string, string[]>();
    for (const row of allAliases) {
      const list = aliasesByHairstyleId.get(row.hairstyleId) ?? [];
      list.push(row.alias);
      aliasesByHairstyleId.set(row.hairstyleId, list);
    }

    const imagesByHairstyleId = new Map<
      string,
      { url: string; displayOrder: number }[]
    >();
    for (const row of allImages) {
      const list = imagesByHairstyleId.get(row.hairstyleId) ?? [];
      list.push({ url: row.url, displayOrder: row.displayOrder });
      imagesByHairstyleId.set(row.hairstyleId, list);
    }

    const tagsByHairstyleId = new Map<string, string[]>();
    for (const row of allTags) {
      const list = tagsByHairstyleId.get(row.hairstyleId) ?? [];
      list.push(row.tag);
      tagsByHairstyleId.set(row.hairstyleId, list);
    }

    const compatByHairstyleId = new Map<
      string,
      Array<{
        attributeType: string;
        attributeValue: string;
        compatibilityScore: string;
      }>
    >();
    for (const row of allCompat) {
      const list = compatByHairstyleId.get(row.hairstyleId) ?? [];
      list.push({
        attributeType: row.attributeType,
        attributeValue: row.attributeValue,
        compatibilityScore: row.compatibilityScore,
      });
      compatByHairstyleId.set(row.hairstyleId, list);
    }

    return knowledgeList.map((hk) => {
      const aliases = aliasesByHairstyleId.get(hk.id) ?? [];
      const previewImages = imagesByHairstyleId.get(hk.id) ?? [];
      const styleTags = tagsByHairstyleId.get(hk.id) ?? [];
      const compRows = compatByHairstyleId.get(hk.id) ?? [];

      return hydrateHairstyleKnowledge(
        hk,
        aliases,
        previewImages,
        styleTags,
        compRows,
      );
    });
  }

  async save(knowledge: HairstyleKnowledge): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(hairstyleKnowledge).values({
        id: knowledge.id,
        name: knowledge.name,
        shortDescription: knowledge.shortDescription,
        longDescription: knowledge.longDescription,
        virtualFilterAssetRef: knowledge.virtualFilterAssetRef,
        minimumHairLength: knowledge.minimumHairLength,
        recommendedHairLength: knowledge.recommendedHairLength,
        maintenanceLevel: knowledge.maintenanceLevel,
        stylingDifficulty: knowledge.stylingDifficulty,
        professionalNotes: knowledge.professionalNotes,
        commonMistakes: knowledge.commonMistakes,
        recommendedProductsPlaceholder:
          knowledge.recommendedProductsPlaceholder,
        isActive: knowledge.isActive,
      });

      if (knowledge.aliases.length > 0) {
        await tx.insert(hairstyleAliases).values(
          knowledge.aliases.map((alias: string) => ({
            hairstyleId: knowledge.id,
            alias,
          })),
        );
      }

      if (knowledge.previewImages.length > 0) {
        await tx.insert(hairstylePreviewImages).values(
          knowledge.previewImages.map(
            (img: { url: string; displayOrder: number }) => ({
              hairstyleId: knowledge.id,
              url: img.url,
              displayOrder: img.displayOrder,
            }),
          ),
        );
      }

      if (knowledge.styleTags.length > 0) {
        await tx.insert(hairstyleStyleTags).values(
          knowledge.styleTags.map((tag: string) => ({
            hairstyleId: knowledge.id,
            tag,
          })),
        );
      }

      const compRows = buildCompatibilityRows(
        knowledge.id,
        knowledge.compatibility,
      );
      if (compRows.length > 0) {
        await tx.insert(hairstyleCompatibility).values(compRows);
      }
    });
  }

  async update(knowledge: HairstyleKnowledge): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(hairstyleKnowledge)
        .set({
          name: knowledge.name,
          shortDescription: knowledge.shortDescription,
          longDescription: knowledge.longDescription,
          virtualFilterAssetRef: knowledge.virtualFilterAssetRef,
          minimumHairLength: knowledge.minimumHairLength,
          recommendedHairLength: knowledge.recommendedHairLength,
          maintenanceLevel: knowledge.maintenanceLevel,
          stylingDifficulty: knowledge.stylingDifficulty,
          professionalNotes: knowledge.professionalNotes,
          commonMistakes: knowledge.commonMistakes,
          recommendedProductsPlaceholder:
            knowledge.recommendedProductsPlaceholder,
          isActive: knowledge.isActive,
          updatedAt: new Date(),
        })
        .where(eq(hairstyleKnowledge.id, knowledge.id));

      await tx
        .delete(hairstyleAliases)
        .where(eq(hairstyleAliases.hairstyleId, knowledge.id));
      if (knowledge.aliases.length > 0) {
        await tx.insert(hairstyleAliases).values(
          knowledge.aliases.map((alias: string) => ({
            hairstyleId: knowledge.id,
            alias,
          })),
        );
      }

      await tx
        .delete(hairstylePreviewImages)
        .where(eq(hairstylePreviewImages.hairstyleId, knowledge.id));
      if (knowledge.previewImages.length > 0) {
        await tx.insert(hairstylePreviewImages).values(
          knowledge.previewImages.map(
            (img: { url: string; displayOrder: number }) => ({
              hairstyleId: knowledge.id,
              url: img.url,
              displayOrder: img.displayOrder,
            }),
          ),
        );
      }

      await tx
        .delete(hairstyleStyleTags)
        .where(eq(hairstyleStyleTags.hairstyleId, knowledge.id));
      if (knowledge.styleTags.length > 0) {
        await tx.insert(hairstyleStyleTags).values(
          knowledge.styleTags.map((tag: string) => ({
            hairstyleId: knowledge.id,
            tag,
          })),
        );
      }

      await tx
        .delete(hairstyleCompatibility)
        .where(eq(hairstyleCompatibility.hairstyleId, knowledge.id));
      const compRows = buildCompatibilityRows(
        knowledge.id,
        knowledge.compatibility,
      );
      if (compRows.length > 0) {
        await tx.insert(hairstyleCompatibility).values(compRows);
      }
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.db
      .update(hairstyleKnowledge)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(hairstyleKnowledge.id, id));
  }
}
