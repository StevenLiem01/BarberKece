import type { Appointment } from "../models/appointment.js";
import type { AppointmentStatus } from "../domain/appointment-status.js";
import type { TimeInterval } from "../domain/time-interval.js";

export interface CreateAppointmentParams {
  id?: string;
  bookingReference: string;
  customerId: string;
  barberProfileId: string;
  serviceId: string;
  status?: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  serviceDurationMinutes: number;
  priceRupiah: number;
  notes?: string | null;
}

export interface AppointmentRepository {
  createAppointment(params: CreateAppointmentParams): Promise<Appointment>;
  findById(id: string): Promise<Appointment | null>;
  findByBookingReference(reference: string): Promise<Appointment | null>;
  updateStatus(
    id: string,
    status: AppointmentStatus,
    cancellationReason?: string | null,
  ): Promise<Appointment>;
  findActiveByBarberAndInterval(
    barberProfileId: string,
    interval: TimeInterval,
  ): Promise<Appointment[]>;
  findActiveByCustomerAndInterval(
    customerId: string,
    interval: TimeInterval,
  ): Promise<Appointment[]>;
}
