import type { AppointmentRepository } from "../ports/appointment-repository.js";
import type { Appointment } from "../models/appointment.js";
import { AppointmentNotFoundError } from "../errors.js";

export class GetAppointmentUseCase {
  constructor(private readonly appointmentRepository: AppointmentRepository) {}

  async execute(id: string, customerIdContext?: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findById(id);

    if (!appointment) {
      throw new AppointmentNotFoundError(id);
    }

    // IDOR protection
    if (customerIdContext && appointment.customerId !== customerIdContext) {
      throw new AppointmentNotFoundError(id);
    }

    return appointment;
  }
}
