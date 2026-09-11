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
  isAutoAssigned?: boolean;
}

export interface BarberWorkloadSummary {
  barberProfileId: string;
  bookedServiceMinutes: number;
  lastAutoAssignedAt: Date | null;
}

export interface FindBarberAppointmentsFilter {
  from?: Date;
  to?: Date;
  status?: AppointmentStatus | AppointmentStatus[];
}

export interface AppointmentRepository {
  createAppointment(params: CreateAppointmentParams): Promise<Appointment>;
  createConfirmedAppointmentWithRetry(
    params: Omit<CreateAppointmentParams, "bookingReference">,
    generateReference: () => string,
    maxAttempts?: number,
  ): Promise<Appointment>;
  findById(id: string): Promise<Appointment | null>;
  findByBookingReference(reference: string): Promise<Appointment | null>;
  findByCustomerId(customerId: string): Promise<Appointment[]>;
  findByBarberId(
    barberProfileId: string,
    filter?: FindBarberAppointmentsFilter,
  ): Promise<Appointment[]>;
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
  findActiveByBarberAndIntervalExcluding(
    barberProfileId: string,
    interval: TimeInterval,
    excludeAppointmentId: string,
  ): Promise<Appointment[]>;
  findActiveByCustomerAndIntervalExcluding(
    customerId: string,
    interval: TimeInterval,
    excludeAppointmentId: string,
  ): Promise<Appointment[]>;
  lockAppointment(id: string): Promise<Appointment | null>;
  rescheduleAppointment(
    id: string,
    newStartsAt: Date,
    newEndsAt: Date,
  ): Promise<Appointment>;
  getBarberDailyWorkloads(
    barberProfileIds: string[],
    dayStart: Date,
    nextDayStart: Date,
  ): Promise<BarberWorkloadSummary[]>;
}
