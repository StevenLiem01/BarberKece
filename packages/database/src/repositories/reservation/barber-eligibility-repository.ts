import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../../client.js";
import { barberServices } from "../../schema/reservation/barber_services.js";
import { services } from "../../schema/reservation/services.js";
import {
  Service,
  BarberEligibilityRepository,
} from "@barberkece/core/reservation";

export class PostgresBarberEligibilityRepository implements BarberEligibilityRepository {
  constructor(private readonly db: DbOrTx) {}

  async assignService(
    barberProfileId: string,
    serviceId: string,
  ): Promise<void> {
    await this.db
      .insert(barberServices)
      .values({
        barberProfileId,
        serviceId,
      })
      .onConflictDoNothing();
  }

  async removeService(
    barberProfileId: string,
    serviceId: string,
  ): Promise<void> {
    await this.db
      .delete(barberServices)
      .where(
        and(
          eq(barberServices.barberProfileId, barberProfileId),
          eq(barberServices.serviceId, serviceId),
        ),
      );
  }

  async findServicesByBarberId(barberProfileId: string): Promise<Service[]> {
    const results = await this.db
      .select({
        service: services,
      })
      .from(barberServices)
      .innerJoin(services, eq(services.id, barberServices.serviceId))
      .where(eq(barberServices.barberProfileId, barberProfileId))
      .orderBy(services.name);

    return results.map((row) => row.service);
  }

  async isEligible(
    barberProfileId: string,
    serviceId: string,
  ): Promise<boolean> {
    const [found] = await this.db
      .select({ barberProfileId: barberServices.barberProfileId })
      .from(barberServices)
      .where(
        and(
          eq(barberServices.barberProfileId, barberProfileId),
          eq(barberServices.serviceId, serviceId),
        ),
      )
      .limit(1);

    return Boolean(found);
  }

  async findEligibleBarberProfileIds(serviceId: string): Promise<string[]> {
    const results = await this.db
      .select({ barberProfileId: barberServices.barberProfileId })
      .from(barberServices)
      .where(eq(barberServices.serviceId, serviceId))
      .orderBy(barberServices.barberProfileId);

    return results.map((row) => row.barberProfileId);
  }
}
