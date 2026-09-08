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
