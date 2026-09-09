import type { AppointmentRepository } from "./appointment-repository.js";
import type { ScheduleRepository } from "./schedule-repository.js";
import type { BarberEligibilityRepository } from "./barber-eligibility-repository.js";
import type { ServiceRepository } from "./service-repository.js";
import type { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import type { IdempotencyRepository } from "./idempotency-repository.js";

export interface BookingTransactionContext {
  appointmentRepository: AppointmentRepository;
  scheduleRepository: ScheduleRepository;
  barberEligibilityRepository: BarberEligibilityRepository;
  barberProfileRepository: BarberProfileRepository;
  serviceRepository: ServiceRepository;
  idempotencyRepository: IdempotencyRepository;
}

export interface BookingTransactionRunner {
  /**
   * Executes transactional reservation work inside a single database transaction.
   * If any error is thrown, the entire transaction is rolled back.
   */
  run<T>(work: (context: BookingTransactionContext) => Promise<T>): Promise<T>;
}
