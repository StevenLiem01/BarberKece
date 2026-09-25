import { eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../../client.js";
import { barberProfiles } from "../../schema/barber/barber_profiles.js";
import { users } from "../../schema/identity/users.js";
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

      // Fetch displayName from users after insertion
      const userRow = await this.db.query.users.findFirst({
        where: eq(users.id, inserted.userId),
        columns: { displayName: true },
      });

      return {
        id: inserted.id,
        userId: inserted.userId,
        displayName: userRow?.displayName ?? null,
        specialization: inserted.specialization,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      };
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

    // Fetch displayName from users
    const userRow = await this.db.query.users.findFirst({
      where: eq(users.id, updated.userId),
      columns: { displayName: true },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      displayName: userRow?.displayName ?? null,
      specialization: updated.specialization,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async findById(id: string): Promise<BarberProfile | null> {
    const result = await this.db
      .select({
        id: barberProfiles.id,
        userId: barberProfiles.userId,
        displayName: users.displayName,
        specialization: barberProfiles.specialization,
        createdAt: barberProfiles.createdAt,
        updatedAt: barberProfiles.updatedAt,
      })
      .from(barberProfiles)
      .innerJoin(users, eq(barberProfiles.userId, users.id))
      .where(eq(barberProfiles.id, id))
      .limit(1);

    const row = result[0];
    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      displayName: row.displayName,
      specialization: row.specialization,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByUserId(userId: string): Promise<BarberProfile | null> {
    const result = await this.db
      .select({
        id: barberProfiles.id,
        userId: barberProfiles.userId,
        displayName: users.displayName,
        specialization: barberProfiles.specialization,
        createdAt: barberProfiles.createdAt,
        updatedAt: barberProfiles.updatedAt,
      })
      .from(barberProfiles)
      .innerJoin(users, eq(barberProfiles.userId, users.id))
      .where(eq(barberProfiles.userId, userId))
      .limit(1);

    const row = result[0];
    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      displayName: row.displayName,
      specialization: row.specialization,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findAll(): Promise<BarberProfile[]> {
    const result = await this.db
      .select({
        id: barberProfiles.id,
        userId: barberProfiles.userId,
        displayName: users.displayName,
        specialization: barberProfiles.specialization,
        createdAt: barberProfiles.createdAt,
        updatedAt: barberProfiles.updatedAt,
      })
      .from(barberProfiles)
      .innerJoin(users, eq(barberProfiles.userId, users.id))
      .orderBy(barberProfiles.createdAt);

    return result.map((row) => ({
      id: row.id,
      userId: row.userId,
      displayName: row.displayName,
      specialization: row.specialization,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async lockProfiles(ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const sortedIds = [...ids].sort();
    const rows = await this.db
      .select({ id: barberProfiles.id })
      .from(barberProfiles)
      .where(inArray(barberProfiles.id, sortedIds))
      .orderBy(barberProfiles.id)
      .for("update");

    return rows.map((r) => r.id);
  }
}
