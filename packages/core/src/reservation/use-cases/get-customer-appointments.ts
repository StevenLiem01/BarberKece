import type { AppointmentRepository } from "../ports/appointment-repository.js";
import type { Appointment } from "../models/appointment.js";

export class GetCustomerAppointmentsUseCase {
  constructor(private readonly appointmentRepository: AppointmentRepository) {}

  async execute(customerId: string): Promise<Appointment[]> {
    return this.appointmentRepository.findByCustomerId(customerId);
  }
}
