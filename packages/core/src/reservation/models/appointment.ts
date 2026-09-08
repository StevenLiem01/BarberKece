import type { AppointmentStatus } from "../domain/appointment-status.js";

export interface Appointment {
  id: string;
  bookingReference: string;
  customerId: string;
  barberProfileId: string;
  serviceId: string;
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  serviceDurationMinutes: number;
  priceRupiah: number;
  notes: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
