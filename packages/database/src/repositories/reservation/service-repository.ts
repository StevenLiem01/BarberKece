import { eq } from "drizzle-orm";
import type { DbOrTx } from "../../client.js";
import { services } from "../../schema/reservation/services.js";
import {
  Service,
  ServiceRepository,
  CreateServiceParams,
  UpdateServiceParams,
} from "@barberkece/core/reservation";

export class PostgresServiceRepository implements ServiceRepository {
  constructor(private readonly db: DbOrTx) {}

  async createService(params: CreateServiceParams): Promise<Service> {
    const [inserted] = await this.db
      .insert(services)
      .values({
        id: params.id,
        name: params.name,
        description: params.description,
        durationMinutes: params.durationMinutes,
        priceRupiah: params.priceRupiah,
        isActive: params.isActive ?? true,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert service");
    }

    return inserted;
  }

  async updateService(
    id: string,
    params: UpdateServiceParams,
  ): Promise<Service> {
    const [updated] = await this.db
      .update(services)
      .set({
        ...params,
        updatedAt: new Date(),
      })
      .where(eq(services.id, id))
      .returning();

    if (!updated) {
      throw new Error("Service not found");
    }

    return updated;
  }

  async updateServiceStatus(id: string, isActive: boolean): Promise<Service> {
    const [updated] = await this.db
      .update(services)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(services.id, id))
      .returning();

    if (!updated) {
      throw new Error("Service not found");
    }

    return updated;
  }

  async findById(id: string): Promise<Service | null> {
    const service = await this.db.query.services.findFirst({
      where: eq(services.id, id),
    });

    return service ?? null;
  }

  async findAll(): Promise<Service[]> {
    return this.db.query.services.findMany({
      orderBy: (services, { asc }) => [asc(services.name)],
    });
  }

  async findActive(): Promise<Service[]> {
    return this.db.query.services.findMany({
      where: eq(services.isActive, true),
      orderBy: (services, { asc }) => [asc(services.name)],
    });
  }
}
