import { and, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import type { DbOrTx } from "../../client.js";
import { appointments } from "../../schema/reservation/appointments.js";
import {
  Appointment,
  AppointmentNotFoundError,
  AppointmentRepository,
  AppointmentStatus,
  ACTIVE_APPOINTMENT_STATUSES,
  assertValidAppointmentStatusTransition,
  BarberWorkloadSummary,
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
          isAutoAssigned: params.isAutoAssigned ?? false,
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

  async lockAppointment(id: string): Promise<Appointment | null> {
    const [found] = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .for("update");

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

  async findByCustomerId(customerId: string): Promise<Appointment[]> {
    return this.db
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, customerId))
      .orderBy(desc(appointments.startsAt));
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

  async rescheduleAppointment(
    id: string,
    newStartsAt: Date,
    newEndsAt: Date,
  ): Promise<Appointment> {
    try {
      const [updated] = await this.db
        .update(appointments)
        .set({
          startsAt: newStartsAt,
          endsAt: newEndsAt,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

      if (!updated) {
        throw new AppointmentNotFoundError(id);
      }

      return updated;
    } catch (error: unknown) {
      const pgErr = extractPostgresError(error);
      if (pgErr?.code === "23P01") {
        const constraintName = pgErr.constraint_name ?? pgErr.constraint;
        if (constraintName === "no_overlapping_barber_appointments") {
          throw new SlotAlreadyBookedError(undefined, {
            startsAt: newStartsAt,
            endsAt: newEndsAt,
          });
        }
        if (constraintName === "no_overlapping_customer_appointments") {
          throw new CustomerBookingConflictError(undefined, {
            startsAt: newStartsAt,
            endsAt: newEndsAt,
          });
        }
        throw new SlotAlreadyBookedError(undefined, {
          startsAt: newStartsAt,
          endsAt: newEndsAt,
        });
      }
      throw error;
    }
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

  async findActiveByBarberAndIntervalExcluding(
    barberProfileId: string,
    interval: TimeInterval,
    excludeAppointmentId: string,
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
          ne(appointments.id, excludeAppointmentId),
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

  async findActiveByCustomerAndIntervalExcluding(
    customerId: string,
    interval: TimeInterval,
    excludeAppointmentId: string,
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
          ne(appointments.id, excludeAppointmentId),
        ),
      );
  }

  async createConfirmedAppointmentWithRetry(
    params: Omit<CreateAppointmentParams, "bookingReference">,
    generateReference: () => string,
    maxAttempts = 3,
  ): Promise<Appointment> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const bookingReference = generateReference();
      try {
        return await this.db.transaction(async (spTx) => {
          const [inserted] = await spTx
            .insert(appointments)
            .values({
              id: params.id,
              bookingReference,
              customerId: params.customerId,
              barberProfileId: params.barberProfileId,
              serviceId: params.serviceId,
              status: params.status ?? AppointmentStatus.CONFIRMED,
              startsAt: params.startsAt,
              endsAt: params.endsAt,
              serviceDurationMinutes: params.serviceDurationMinutes,
              priceRupiah: params.priceRupiah,
              notes: params.notes ?? null,
              isAutoAssigned: params.isAutoAssigned ?? false,
            })
            .returning();

          if (!inserted) {
            throw new Error("Failed to insert appointment");
          }

          return inserted;
        });
      } catch (error: unknown) {
        const pgErr = extractPostgresError(error);

        // Retry ONLY on booking_reference uniqueness collision
        if (
          pgErr?.code === "23505" &&
          (pgErr.constraint_name === "appointments_booking_reference_unique" ||
            pgErr.constraint === "appointments_booking_reference_unique")
        ) {
          if (attempt < maxAttempts) {
            continue;
          }
          throw error;
        }

        // Translate PostgreSQL GiST exclusion constraint errors
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
          throw new SlotAlreadyBookedError(params.barberProfileId, {
            startsAt: params.startsAt,
            endsAt: params.endsAt,
          });
        }

        throw error;
      }
    }
    throw new Error(
      "Failed to create appointment after maximum retry attempts",
    );
  }

  async getBarberDailyWorkloads(
    barberProfileIds: string[],
    dayStart: Date,
    nextDayStart: Date,
  ): Promise<BarberWorkloadSummary[]> {
    if (barberProfileIds.length === 0) {
      return [];
    }

    const idsList = sql.join(
      barberProfileIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const dayStartIso = dayStart.toISOString();
    const nextDayStartIso = nextDayStart.toISOString();

    const result = await this.db.execute<{
      barber_profile_id: string;
      booked_service_minutes: string | number;
      last_auto_assigned_at: string | Date | null;
    }>(sql`
      SELECT
        bp.id AS barber_profile_id,
        COALESCE(SUM(
          CASE
            WHEN a.status IN ('CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED')
             AND a.starts_at >= ${dayStartIso}::timestamptz
             AND a.starts_at < ${nextDayStartIso}::timestamptz
            THEN a.service_duration_minutes
            ELSE 0
          END
        ), 0)::int AS booked_service_minutes,
        MAX(
          CASE
            WHEN a.is_auto_assigned = true
            THEN a.created_at
            ELSE NULL
          END
        ) AS last_auto_assigned_at
      FROM barber_profiles bp
      LEFT JOIN appointments a ON a.barber_profile_id = bp.id
      WHERE bp.id IN (${idsList})
      GROUP BY bp.id
    `);

    return result.map((row) => ({
      barberProfileId: row.barber_profile_id,
      bookedServiceMinutes: Number(row.booked_service_minutes ?? 0),
      lastAutoAssignedAt: row.last_auto_assigned_at
        ? new Date(row.last_auto_assigned_at)
        : null,
    }));
  }
}
