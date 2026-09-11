import type { AppointmentRepository } from "../ports/appointment-repository.js";
import type { Appointment } from "../models/appointment.js";
import {
  AppointmentNotFoundError,
  AppointmentOwnershipError,
} from "../errors.js";

export interface GetBarberAppointmentDetailInput {
  appointmentId: string;
  barberProfileId: string;
}

export interface GetBarberAppointmentDetailOutput {
  appointment: Appointment;
}

export class GetBarberAppointmentDetailUseCase {
  constructor(private readonly appointmentRepository: AppointmentRepository) {}

  async execute(
    input: GetBarberAppointmentDetailInput,
  ): Promise<GetBarberAppointmentDetailOutput> {
    if (!input.appointmentId || typeof input.appointmentId !== "string") {
      throw new Error("appointmentId is required");
    }
    if (!input.barberProfileId || typeof input.barberProfileId !== "string") {
      throw new Error("barberProfileId is required");
    }

    const appointment = await this.appointmentRepository.findById(
      input.appointmentId,
    );
    if (!appointment) {
      throw new AppointmentNotFoundError(input.appointmentId);
    }

    if (appointment.barberProfileId !== input.barberProfileId) {
      throw new AppointmentOwnershipError(
        input.appointmentId,
        input.barberProfileId,
      );
    }

    return { appointment };
  }
}
