import type { Clock } from "../ports/clock.js";
import type { BookingTransactionRunner } from "../ports/booking-transaction-runner.js";
import { AppointmentStatus } from "../domain/appointment-status.js";
import type { Appointment } from "../models/appointment.js";
import {
  AppointmentNotFoundError,
  AppointmentOwnershipError,
  CancellationCutoffExceededError,
  InvalidAppointmentStatusTransitionError,
} from "../errors.js";

const DEFAULT_CANCELLATION_CUTOFF_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface CancelAppointmentInput {
  actorId: string;
  appointmentId: string;
  cancellationReason?: string | null;
}

export interface CancelAppointmentOutput {
  appointment: Appointment;
}

export class CancelAppointmentUseCase {
  constructor(
    private readonly transactionRunner: BookingTransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: CancelAppointmentInput,
  ): Promise<CancelAppointmentOutput> {
    // Freeze server clock once per execution
    const now = this.clock.now();

    return await this.transactionRunner.run(async (context) => {
      // 1. Lock appointment row
      const appointment = await context.appointmentRepository.lockAppointment(
        input.appointmentId,
      );
      if (!appointment) {
        throw new AppointmentNotFoundError(input.appointmentId);
      }

      // 2. Ownership check (Customer must own the appointment)
      if (appointment.customerId !== input.actorId) {
        throw new AppointmentOwnershipError(input.appointmentId, input.actorId);
      }

      // 3. Status check (Only CONFIRMED can be cancelled by customer)
      if (appointment.status !== AppointmentStatus.CONFIRMED) {
        throw new InvalidAppointmentStatusTransitionError(
          appointment.status,
          AppointmentStatus.CANCELLED_BY_CUSTOMER,
        );
      }

      // 4. Cutoff check (Must be >= 2 hours before appointment start time)
      const timeUntilStart = appointment.startsAt.getTime() - now.getTime();
      if (timeUntilStart < DEFAULT_CANCELLATION_CUTOFF_MS) {
        throw new CancellationCutoffExceededError(appointment.startsAt);
      }

      // 5. Update status to CANCELLED_BY_CUSTOMER with optional cancellationReason
      const updated = await context.appointmentRepository.updateStatus(
        input.appointmentId,
        AppointmentStatus.CANCELLED_BY_CUSTOMER,
        input.cancellationReason ?? null,
      );

      return {
        appointment: updated,
      };
    });
  }
}
