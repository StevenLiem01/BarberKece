import { and, eq, gt, inArray, lt } from "drizzle-orm";
import type { DbOrTx } from "../../client.js";
import { appointments } from "../../schema/reservation/appointments.js";
import {
  Appointment,
  AppointmentNotFoundError,
  AppointmentRepository,
  AppointmentStatus,
  ACTIVE_APPOINTMENT_STATUSES,
  assertValidAppointmentStatusTransition,
  CreateAppointmentParams,
  CustomerBookingConflictError,
  SlotAlreadyBookedError,
  TimeInterval,
} from "@barberkece/core/reservation";

interface StructuredPgError {
  code?: string;
  constraint_name?: string;
  constraint?: string;
}

function extractPostgresError(error: unknown): StructuredPgError | null {
  if (typeof error === "object" && error !== null) {
    if ("code" in error) {
      return error as StructuredPgError;
    }
    if (
      "cause" in error &&
      typeof (error as { cause?: unknown }).cause === "object" &&
      (error as { cause: unknown }).cause !== null
    ) {
      const cause = (error as { cause: StructuredPgError }).cause;
      if ("code" in cause) {
        return cause;
      }
    }
  }
  return null;
}

export class PostgresAppointmentRepository implements AppointmentRepository {
  constructor(private readonly db: DbOrTx) {}

  async createAppointment(
    params: CreateAppointmentParams,
  ): Promise<Appointment> {
    try {
      const [inserted] = await this.db
        .insert(appointments)
        .values({
          id: params.id,
          bookingReference: params.bookingReference,
          customerId: params.customerId,
          barberProfileId: params.barberProfileId,
          serviceId: params.serviceId,
          status: params.status ?? AppointmentStatus.CONFIRMED,
          startsAt: params.startsAt,
          endsAt: params.endsAt,
          serviceDurationMinutes: params.serviceDurationMinutes,
          priceRupiah: params.priceRupiah,
          notes: params.notes ?? null,
        })
        .returning();

      if (!inserted) {
        throw new Error("Failed to insert appointment");
      }

      return inserted;
    } catch (error: unknown) {
      const pgErr = extractPostgresError(error);
      if (pgErr?.code === "23P01") {
        const constraintName = pgErr.constraint_name ?? pgErr.constraint;
        if (constraintName === "no_overlapping_barber_appointments") {
          throw new SlotAlreadyBookedError(params.barberProfileId, {
            startsAt: params.startsAt,
            endsAt: params.endsAt,
          });
        }
        if (constraintName === "no_overlapping_customer_appointments") {
          throw new CustomerBookingConflictError(params.customerId, {
            startsAt: params.startsAt,
            endsAt: params.endsAt,
          });
        }
        // Fallback default
        throw new SlotAlreadyBookedError(params.barberProfileId, {
          startsAt: params.startsAt,
          endsAt: params.endsAt,
        });
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Appointment | null> {
    const [found] = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    return found ?? null;
  }

  async findByBookingReference(reference: string): Promise<Appointment | null> {
    const [found] = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.bookingReference, reference))
      .limit(1);

    return found ?? null;
  }

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    cancellationReason?: string | null,
  ): Promise<Appointment> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppointmentNotFoundError(id);
    }

    assertValidAppointmentStatusTransition(existing.status, status);

    const [updated] = await this.db
      .update(appointments)
      .set({
        status,
        cancellationReason:
          cancellationReason !== undefined
            ? cancellationReason
            : existing.cancellationReason,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update appointment status");
    }

    return updated;
  }

  async findActiveByBarberAndInterval(
    barberProfileId: string,
    interval: TimeInterval,
  ): Promise<Appointment[]> {
    return this.db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.barberProfileId, barberProfileId),
          inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
          lt(appointments.startsAt, interval.endsAt),
          gt(appointments.endsAt, interval.startsAt),
        ),
      );
  }

  async findActiveByCustomerAndInterval(
    customerId: string,
    interval: TimeInterval,
  ): Promise<Appointment[]> {
    return this.db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.customerId, customerId),
          inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
          lt(appointments.startsAt, interval.endsAt),
          gt(appointments.endsAt, interval.startsAt),
        ),
      );
  }
}
