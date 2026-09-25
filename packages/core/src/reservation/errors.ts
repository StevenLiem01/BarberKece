export class ReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationError";
  }
}

export class ServiceNotFoundError extends ReservationError {
  constructor(id: string) {
    super(`Service not found: ${id}`);
    this.name = "ServiceNotFoundError";
  }
}

export class SlotAlreadyBookedError extends ReservationError {
  constructor(
    barberProfileId?: string,
    interval?: { startsAt: Date; endsAt: Date },
  ) {
    const details =
      barberProfileId && interval
        ? ` for barber ${barberProfileId} at ${interval.startsAt.toISOString()} - ${interval.endsAt.toISOString()}`
        : "";
    super(`The requested appointment slot is already booked${details}`);
    this.name = "SlotAlreadyBookedError";
  }
}

export class CustomerBookingConflictError extends ReservationError {
  constructor(
    customerId?: string,
    interval?: { startsAt: Date; endsAt: Date },
  ) {
    const details =
      customerId && interval
        ? ` for customer ${customerId} at ${interval.startsAt.toISOString()} - ${interval.endsAt.toISOString()}`
        : "";
    super(
      `The customer already has an active appointment in this time window${details}`,
    );
    this.name = "CustomerBookingConflictError";
  }
}

export class AppointmentNotFoundError extends ReservationError {
  constructor(id: string) {
    super(`Appointment not found: ${id}`);
    this.name = "AppointmentNotFoundError";
  }
}

export class InvalidTimeIntervalError extends ReservationError {
  constructor(message = "End time must be strictly after start time") {
    super(message);
    this.name = "InvalidTimeIntervalError";
  }
}

export class InvalidAppointmentStatusTransitionError extends ReservationError {
  constructor(from: string, to: string) {
    super(`Invalid appointment status transition from ${from} to ${to}`);
    this.name = "InvalidAppointmentStatusTransitionError";
  }
}

export class InactiveServiceError extends ReservationError {
  constructor(id: string) {
    super(`Service is inactive: ${id}`);
    this.name = "InactiveServiceError";
  }
}

export class BarberNotEligibleError extends ReservationError {
  constructor(barberProfileId: string, serviceId: string) {
    super(
      `Barber ${barberProfileId} is not eligible to perform service ${serviceId}`,
    );
    this.name = "BarberNotEligibleError";
  }
}

export class BarberNotAvailableForBookingError extends ReservationError {
  constructor(barberProfileId: string) {
    super(`Barber ${barberProfileId} is not available for booking`);
    this.name = "BarberNotAvailableForBookingError";
  }
}

export class InvalidBookingDateError extends ReservationError {
  constructor(message = "Booking date is invalid or in the past") {
    super(message);
    this.name = "InvalidBookingDateError";
  }
}

export class BookingHorizonExceededError extends ReservationError {
  constructor(date: string, maxDate: string) {
    super(`Booking date ${date} exceeds maximum booking horizon of ${maxDate}`);
    this.name = "BookingHorizonExceededError";
  }
}

export class InvalidBookingHorizonConfigError extends ReservationError {
  constructor(days: number) {
    super(
      `Invalid booking horizon configuration: ${days} days (must be between 7 and 90 days)`,
    );
    this.name = "InvalidBookingHorizonConfigError";
  }
}

export class OutsideBusinessHoursError extends ReservationError {
  constructor(
    message = "Requested appointment interval falls outside business hours",
  ) {
    super(message);
    this.name = "OutsideBusinessHoursError";
  }
}

export class BarberNotWorkingError extends ReservationError {
  constructor(barberProfileId: string) {
    super(
      `Barber ${barberProfileId} is not scheduled to work during the requested time window`,
    );
    this.name = "BarberNotWorkingError";
  }
}

export class ScheduleExceptionConflictError extends ReservationError {
  constructor(reason: string) {
    super(
      `Requested appointment conflicts with a schedule exception: ${reason}`,
    );
    this.name = "ScheduleExceptionConflictError";
  }
}

export class IdempotencyPayloadMismatchError extends ReservationError {
  constructor(key: string) {
    super(
      `Idempotency key "${key}" was previously used with a different request payload`,
    );
    this.name = "IdempotencyPayloadMismatchError";
  }
}

export class AppointmentOwnershipError extends ReservationError {
  constructor(appointmentId: string, actorId: string) {
    super(
      `Actor ${actorId} is not authorized to manage appointment ${appointmentId}`,
    );
    this.name = "AppointmentOwnershipError";
  }
}

export class CancellationCutoffExceededError extends ReservationError {
  constructor(startsAt: Date, cutoffHours = 2) {
    super(
      `Appointment at ${startsAt.toISOString()} cannot be cancelled less than ${cutoffHours} hours before start time`,
    );
    this.name = "CancellationCutoffExceededError";
  }
}

export class RescheduleCutoffExceededError extends ReservationError {
  constructor(startsAt: Date, cutoffHours = 2) {
    super(
      `Appointment at ${startsAt.toISOString()} cannot be rescheduled less than ${cutoffHours} hours before start time`,
    );
    this.name = "RescheduleCutoffExceededError";
  }
}

export class NoShowGracePeriodNotElapsedError extends ReservationError {
  constructor(startsAt: Date, gracePeriodMinutes = 15) {
    super(
      `Appointment at ${startsAt.toISOString()} cannot be marked as No-Show before the grace period of ${gracePeriodMinutes} minutes has elapsed`,
    );
    this.name = "NoShowGracePeriodNotElapsedError";
  }
}

export class CancellationReasonRequiredError extends ReservationError {
  constructor(
    message = "Cancellation reason is required when barbershop cancels an appointment",
  ) {
    super(message);
    this.name = "CancellationReasonRequiredError";
  }
}
