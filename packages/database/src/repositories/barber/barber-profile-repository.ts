import { eq } from "drizzle-orm";
import type { DbOrTx } from "../../client.js";
import { barberProfiles } from "../../schema/barber/barber_profiles.js";
import {
  BarberProfile,
  BarberProfileAlreadyExistsError,
  BarberProfileRepository,
  ProvisionBarberProfileParams,
} from "@barberkece/core/barber";

export class PostgresBarberProfileRepository implements BarberProfileRepository {
  constructor(private readonly db: DbOrTx) {}

  async provisionProfile(
    params: ProvisionBarberProfileParams,
  ): Promise<BarberProfile> {
    try {
      const [inserted] = await this.db
        .insert(barberProfiles)
        .values({
          id: params.id,
          userId: params.userId,
          specialization: params.specialization ?? null,
        })
        .returning();

      if (!inserted) {
        throw new Error("Failed to provision barber profile");
      }

      return inserted;
    } catch (error: unknown) {
      if (
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "23505") ||
        (typeof error === "object" &&
          error !== null &&
          "cause" in error &&
          typeof (error as { cause?: unknown }).cause === "object" &&
          (error as { cause: { code?: string } }).cause !== null &&
          "code" in (error as { cause: { code?: string } }).cause &&
          (error as { cause: { code?: string } }).cause.code === "23505")
      ) {
        throw new BarberProfileAlreadyExistsError(params.userId);
      }
      throw error;
    }
  }

  async updateSpecialization(
    id: string,
    specialization: string | null,
  ): Promise<BarberProfile> {
    const [updated] = await this.db
      .update(barberProfiles)
      .set({
        specialization,
        updatedAt: new Date(),
      })
      .where(eq(barberProfiles.id, id))
      .returning();

    if (!updated) {
      throw new Error("Barber profile not found");
    }

    return updated;
  }

  async findById(id: string): Promise<BarberProfile | null> {
    const profile = await this.db.query.barberProfiles.findFirst({
      where: eq(barberProfiles.id, id),
    });

    return profile ?? null;
  }

  async findByUserId(userId: string): Promise<BarberProfile | null> {
    const profile = await this.db.query.barberProfiles.findFirst({
      where: eq(barberProfiles.userId, userId),
    });

    return profile ?? null;
  }

  async findAll(): Promise<BarberProfile[]> {
    return this.db.query.barberProfiles.findMany({
      orderBy: (barberProfiles, { desc }) => [desc(barberProfiles.createdAt)],
    });
  }
}
