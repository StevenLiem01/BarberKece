import type { Database } from "../../client.js";
import type {
  BookingTransactionRunner,
  BookingTransactionContext,
} from "@barberkece/core/reservation";
import { PostgresAppointmentRepository } from "./postgres-appointment-repository.js";
import { PostgresScheduleRepository } from "./postgres-schedule-repository.js";
import { PostgresBarberEligibilityRepository } from "./barber-eligibility-repository.js";
import { PostgresBarberProfileRepository } from "../barber/barber-profile-repository.js";
import { PostgresServiceRepository } from "./service-repository.js";
import { PostgresIdempotencyRepository } from "./postgres-idempotency-repository.js";

export class PostgresBookingTransactionRunner implements BookingTransactionRunner {
  constructor(private readonly db: Database) {}

  async run<T>(
    work: (context: BookingTransactionContext) => Promise<T>,
  ): Promise<T> {
    return await this.db.transaction(async (tx) => {
      const appointmentRepository = new PostgresAppointmentRepository(tx);
      const scheduleRepository = new PostgresScheduleRepository(tx);
      const barberEligibilityRepository =
        new PostgresBarberEligibilityRepository(tx);
      const barberProfileRepository = new PostgresBarberProfileRepository(tx);
      const serviceRepository = new PostgresServiceRepository(tx);
      const idempotencyRepository = new PostgresIdempotencyRepository(tx);

      return await work({
        appointmentRepository,
        scheduleRepository,
        barberEligibilityRepository,
        barberProfileRepository,
        serviceRepository,
        idempotencyRepository,
      });
    });
  }
}
