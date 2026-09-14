import { eq } from "drizzle-orm";
import { Database } from "../client.js";
import { hairProfiles } from "../schema/index.js";
import {
  HairProfile,
  HairProfileRepository,
  SaveHairProfileInput,
} from "@barberkece/core/identity";
import {
  FaceShape,
  HairType,
  HairDensity,
  HairLength,
  MaintenanceLevel,
} from "@barberkece/core/recommendation";

export class PostgresHairProfileRepository implements HairProfileRepository {
  constructor(private readonly db: Database) {}

  async getHairProfileByCustomerId(
    customerId: string,
  ): Promise<HairProfile | null> {
    const records = await this.db
      .select()
      .from(hairProfiles)
      .where(eq(hairProfiles.customerId, customerId))
      .limit(1);

    if (records.length === 0) return null;

    return this.mapToDomain(records[0]);
  }

  async saveHairProfile(input: SaveHairProfileInput): Promise<HairProfile> {
    const records = await this.db
      .insert(hairProfiles)
      .values({
        customerId: input.customerId,
        faceShape: input.faceShape ?? null,
        hairType: input.hairType ?? null,
        hairDensity: input.hairDensity ?? null,
        hairLength: input.hairLength ?? null,
        maintenance: input.maintenance ?? null,
        styleTags: input.styleTags ?? [],
      })
      .onConflictDoUpdate({
        target: hairProfiles.customerId,
        set: {
          faceShape: input.faceShape ?? null,
          hairType: input.hairType ?? null,
          hairDensity: input.hairDensity ?? null,
          hairLength: input.hairLength ?? null,
          maintenance: input.maintenance ?? null,
          styleTags: input.styleTags ?? [],
          updatedAt: new Date(),
        },
      })
      .returning();

    return this.mapToDomain(records[0]);
  }

  private mapToDomain(r: typeof hairProfiles.$inferSelect): HairProfile {
    return {
      id: r.id,
      customerId: r.customerId,
      faceShape: r.faceShape as FaceShape | null,
      hairType: r.hairType as HairType | null,
      hairDensity: r.hairDensity as HairDensity | null,
      hairLength: r.hairLength as HairLength | null,
      maintenance: r.maintenance as MaintenanceLevel | null,
      styleTags: r.styleTags ?? [],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
