import type { AppointmentRepository } from "../ports/appointment-repository.js";
import type { Appointment } from "../models/appointment.js";
import type { AppointmentStatus } from "../domain/appointment-status.js";
import {
  getJakartaDayBoundaries,
  isValidCalendarDateString,
} from "../domain/date-utils.js";
import { InvalidBookingDateError } from "../errors.js";

export interface GetBarberAppointmentsInput {
  barberProfileId: string;
  date?: string; // Optional "YYYY-MM-DD" representing Asia/Jakarta calendar date
  from?: Date;
  to?: Date;
  status?: AppointmentStatus | AppointmentStatus[];
}

export interface GetBarberAppointmentsOutput {
  appointments: Appointment[];
}

export class GetBarberAppointmentsUseCase {
  constructor(private readonly appointmentRepository: AppointmentRepository) {}

  async execute(
    input: GetBarberAppointmentsInput,
  ): Promise<GetBarberAppointmentsOutput> {
    if (!input.barberProfileId || typeof input.barberProfileId !== "string") {
      throw new Error("barberProfileId is required");
    }

    let from = input.from;
    let to = input.to;

    // Reject ambiguous combination of both single date and explicit range
    if (input.date && (input.from !== undefined || input.to !== undefined)) {
      throw new Error("Cannot specify both date and explicit from/to range");
    }

    // If Jakarta calendar date is provided, derive day boundaries [dayStart, nextDayStart)
    if (input.date) {
      if (!isValidCalendarDateString(input.date)) {
        throw new InvalidBookingDateError(`Invalid date string: ${input.date}`);
      }
      const boundaries = getJakartaDayBoundaries(input.date);
      from = boundaries.dayStart;
      to = boundaries.nextDayStart;
    }

    // Validate from < to if both boundaries are present
    if (from && to && from.getTime() >= to.getTime()) {
      throw new Error("from must be before to");
    }

    const appointments = await this.appointmentRepository.findByBarberId(
      input.barberProfileId,
      {
        from,
        to,
        status: input.status,
      },
    );

    return { appointments };
  }
}
