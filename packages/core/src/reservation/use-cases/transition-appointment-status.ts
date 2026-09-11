import type { Clock } from "../ports/clock.js";
import type { BookingTransactionRunner } from "../ports/booking-transaction-runner.js";
import {
  AppointmentStatus,
  assertValidAppointmentStatusTransition,
} from "../domain/appointment-status.js";
import type { Appointment } from "../models/appointment.js";
import {
  AppointmentNotFoundError,
  AppointmentOwnershipError,
  CancellationReasonRequiredError,
  InvalidAppointmentStatusTransitionError,
  NoShowGracePeriodNotElapsedError,
} from "../errors.js";

const DEFAULT_NO_SHOW_GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes

const ALLOWED_BARBER_TARGET_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_SERVICE,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.CANCELLED_BY_BARBERSHOP,
];

export interface TransitionAppointmentStatusInput {
  appointmentId: string;
  barberProfileId: string;
  targetStatus: AppointmentStatus;
  cancellationReason?: string | null;
}

export interface TransitionAppointmentStatusOutput {
  appointment: Appointment;
}

export class TransitionAppointmentStatusUseCase {
  constructor(
    private readonly transactionRunner: BookingTransactionRunner,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: TransitionAppointmentStatusInput,
  ): Promise<TransitionAppointmentStatusOutput> {
    if (!input.appointmentId || typeof input.appointmentId !== "string") {
      throw new Error("appointmentId is required");
    }
    if (!input.barberProfileId || typeof input.barberProfileId !== "string") {
      throw new Error("barberProfileId is required");
    }
    if (!input.targetStatus || typeof input.targetStatus !== "string") {
      throw new Error("targetStatus is required");
    }

    // Freeze server clock once per execution
    const now = this.clock.now();

    return await this.transactionRunner.run(async (context) => {
      // 1. Lock appointment row inside transaction
      const appointment = await context.appointmentRepository.lockAppointment(
        input.appointmentId,
      );
      if (!appointment) {
        throw new AppointmentNotFoundError(input.appointmentId);
      }

      // 2. Ownership check: Must be assigned to the requesting barber
      if (appointment.barberProfileId !== input.barberProfileId) {
        throw new AppointmentOwnershipError(
          input.appointmentId,
          input.barberProfileId,
        );
      }

      // 3. Domain status transition validation
      // Ensure target is a canonical barber operational target (e.g. BARBER cannot perform CANCELLED_BY_CUSTOMER)
      if (!ALLOWED_BARBER_TARGET_STATUSES.includes(input.targetStatus)) {
        throw new InvalidAppointmentStatusTransitionError(
          appointment.status,
          input.targetStatus,
        );
      }

      assertValidAppointmentStatusTransition(
        appointment.status,
        input.targetStatus,
      );

      // 4. Operational rules per canonical status requirements
      if (input.targetStatus === AppointmentStatus.NO_SHOW) {
        // Canonical grace period rule: must be at least 15 minutes past scheduled start time
        if (
          now.getTime() <
          appointment.startsAt.getTime() + DEFAULT_NO_SHOW_GRACE_PERIOD_MS
        ) {
          throw new NoShowGracePeriodNotElapsedError(appointment.startsAt, 15);
        }
      }

      let cancellationReason: string | null | undefined = undefined;
      if (input.targetStatus === AppointmentStatus.CANCELLED_BY_BARBERSHOP) {
        const trimmed = input.cancellationReason?.trim();
        if (!trimmed) {
          throw new CancellationReasonRequiredError(
            "Cancellation reason is required when barbershop cancels an appointment",
          );
        }
        cancellationReason = trimmed;
      }

      // 5. Update appointment status under row lock
      const updated = await context.appointmentRepository.updateStatus(
        input.appointmentId,
        input.targetStatus,
        cancellationReason,
      );

      return {
        appointment: updated,
      };
    });
  }
}
