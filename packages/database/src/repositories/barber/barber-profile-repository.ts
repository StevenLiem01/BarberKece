import { eq } from "drizzle-orm";
import type { DbOrTx } from "../../client.js";
import { barberProfiles } from "../../schema/barber/barber_profiles.js";
import {
  BarberProfile,
  BarberProfileRepository,
  ProvisionBarberProfileParams,
} from "@barberkece/core/barber";

export class PostgresBarberProfileRepository implements BarberProfileRepository {
  constructor(private readonly db: DbOrTx) {}

  async provisionProfile(
    params: ProvisionBarberProfileParams,
  ): Promise<BarberProfile> {
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
