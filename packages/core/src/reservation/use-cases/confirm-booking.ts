import { createHash } from "node:crypto";
import type { Clock } from "../ports/clock.js";
import type { BookingTransactionRunner } from "../ports/booking-transaction-runner.js";
import type { BookingReferenceGenerator } from "../domain/booking-reference.js";
import { DefaultBookingReferenceGenerator } from "../domain/booking-reference.js";
import { FairnessSelector } from "../domain/fairness-selector.js";
import { AppointmentStatus } from "../domain/appointment-status.js";
import type { Appointment } from "../models/appointment.js";
import {
  addCalendarDaysToDateString,
  getJakartaCalendarDateString,
  getJakartaDayBoundaries,
  getJakartaDayOfWeek,
  parseJakartaWallClockInstant,
} from "../domain/date-utils.js";
import { TimeInterval } from "../domain/time-interval.js";
import {
  BarberNotAvailableForBookingError,
  BarberNotEligibleError,
  BarberNotWorkingError,
  BookingHorizonExceededError,
  CustomerBookingConflictError,
  IdempotencyPayloadMismatchError,
  InactiveServiceError,
  InvalidBookingDateError,
  InvalidBookingHorizonConfigError,
  OutsideBusinessHoursError,
  ScheduleExceptionConflictError,
  ServiceNotFoundError,
  SlotAlreadyBookedError,
} from "../errors.js";
import { BarberProfileNotFoundError } from "../../barber/errors.js";

const DEFAULT_BOOKING_HORIZON_DAYS = 30;
const MIN_BOOKING_HORIZON_DAYS = 7;
const MAX_BOOKING_HORIZON_DAYS = 90;
const QUARTER_HOUR_MS = 15 * 60 * 1000;
const CONFIRM_BOOKING_OPERATION = "CONFIRM_BOOKING";

export interface ConfirmBookingInput {
  actorId: string;
  customerId: string;
  serviceId: string;
  startsAt: Date;
  barberProfileId?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
}

export interface ConfirmBookingOutput {
  appointment: Appointment;
  isIdempotentReplay: boolean;
}

export function computeBookingRequestHash(payload: {
  serviceId: string;
  startsAt: Date;
  barberProfileId?: string | null;
  notes?: string | null;
}): string {
  const canonicalJson = JSON.stringify({
    serviceId: payload.serviceId,
    startsAt: payload.startsAt.toISOString(),
    barberProfileId: payload.barberProfileId ?? null,
    notes: payload.notes ?? null,
  });

  return createHash("sha256").update(canonicalJson).digest("hex");
}

export class ConfirmBookingUseCase {
  private readonly bookingHorizonDays: number;
  private readonly referenceGenerator: BookingReferenceGenerator;

  constructor(
    private readonly transactionRunner: BookingTransactionRunner,
    private readonly clock: Clock,
    options?: {
      referenceGenerator?: BookingReferenceGenerator;
      bookingHorizonDays?: number;
    },
  ) {
    this.referenceGenerator =
      options?.referenceGenerator ?? new DefaultBookingReferenceGenerator();

    const horizon = options?.bookingHorizonDays ?? DEFAULT_BOOKING_HORIZON_DAYS;
    if (
      horizon < MIN_BOOKING_HORIZON_DAYS ||
      horizon > MAX_BOOKING_HORIZON_DAYS
    ) {
      throw new InvalidBookingHorizonConfigError(horizon);
    }
    this.bookingHorizonDays = horizon;
  }

  async execute(input: ConfirmBookingInput): Promise<ConfirmBookingOutput> {
    // Freeze clock.now() exactly once per execution
    const now = this.clock.now();

    // 1. startsAt must be strictly in the future
    if (input.startsAt.getTime() <= now.getTime()) {
      throw new InvalidBookingDateError(
        "Appointment start time must be in the future",
      );
    }

    // 2. startsAt must lie exactly on the 15-minute grid (:00, :15, :30, :45)
    if (input.startsAt.getTime() % QUARTER_HOUR_MS !== 0) {
      throw new InvalidBookingDateError(
        "Appointment start time must be on a 15-minute boundary (:00, :15, :30, :45)",
      );
    }

    // 3. Validate booking horizon using Asia/Jakarta date utilities
    const todayJakarta = getJakartaCalendarDateString(now);
    const targetDateJakarta = getJakartaCalendarDateString(input.startsAt);

    if (targetDateJakarta < todayJakarta) {
      throw new InvalidBookingDateError("Booking date cannot be in the past");
    }

    const maxDateJakarta = addCalendarDaysToDateString(
      todayJakarta,
      this.bookingHorizonDays,
    );
    if (targetDateJakarta > maxDateJakarta) {
      throw new BookingHorizonExceededError(targetDateJakarta, maxDateJakarta);
    }

    // 4. Compute request hash if idempotencyKey is present
    const requestHash = input.idempotencyKey
      ? computeBookingRequestHash({
          serviceId: input.serviceId,
          startsAt: input.startsAt,
          barberProfileId: input.barberProfileId,
          notes: input.notes,
        })
      : null;

    // 5. Execute all transactional checks and writes within the transaction runner
    return await this.transactionRunner.run(async (context) => {
      // Step A: If idempotencyKey is present, acquire advisory lock and check idempotency_records
      if (input.idempotencyKey && requestHash) {
        await context.idempotencyRepository.acquireAdvisoryLock(
          input.actorId,
          CONFIRM_BOOKING_OPERATION,
          input.idempotencyKey,
        );

        const existingRecord = await context.idempotencyRepository.findByKey(
          input.actorId,
          CONFIRM_BOOKING_OPERATION,
          input.idempotencyKey,
        );

        if (existingRecord) {
          if (existingRecord.requestHash !== requestHash) {
            throw new IdempotencyPayloadMismatchError(input.idempotencyKey);
          }

          const existingAppt = await context.appointmentRepository.findById(
            existingRecord.appointmentId,
          );
          if (!existingAppt) {
            throw new Error(
              "Idempotent appointment record references missing appointment",
            );
          }

          return {
            appointment: existingAppt,
            isIdempotentReplay: true,
          };
        }
      }

      // Step B: Load and validate service
      const service = await context.serviceRepository.findById(input.serviceId);
      if (!service) {
        throw new ServiceNotFoundError(input.serviceId);
      }
      if (!service.isActive) {
        throw new InactiveServiceError(input.serviceId);
      }

      // Step C: Server-derived duration, price, and endsAt snapshot
      const serviceDurationMinutes = service.durationMinutes;
      const priceRupiah = service.priceRupiah;
      const endsAt = new Date(
        input.startsAt.getTime() + serviceDurationMinutes * 60 * 1000,
      );
      const appointmentInterval = new TimeInterval(input.startsAt, endsAt);

      // Step D: Revalidate business hours for the appointment interval
      const dayOfWeek = getJakartaDayOfWeek(targetDateJakarta);
      const businessHours =
        await context.scheduleRepository.getBusinessHoursForDay(dayOfWeek);

      if (!businessHours || businessHours.isClosed) {
        throw new OutsideBusinessHoursError("Shop is closed on this day");
      }

      const shopOpen = parseJakartaWallClockInstant(
        targetDateJakarta,
        businessHours.openTime,
      );
      const shopClose = parseJakartaWallClockInstant(
        targetDateJakarta,
        businessHours.closeTime,
      );

      if (input.startsAt < shopOpen || endsAt > shopClose) {
        throw new OutsideBusinessHoursError(
          "Appointment interval must fall entirely within business hours",
        );
      }

      // Step E: Revalidate customer overlap
      const customerOverlap =
        await context.appointmentRepository.findActiveByCustomerAndInterval(
          input.customerId,
          appointmentInterval,
        );
      if (customerOverlap.length > 0) {
        throw new CustomerBookingConflictError(
          input.customerId,
          appointmentInterval,
        );
      }

      let assignedBarberProfileId: string;
      let isAutoAssigned: boolean;

      if (input.barberProfileId) {
        // Specific Barber Mode
        const lockedProfiles =
          await context.barberProfileRepository.lockProfiles([
            input.barberProfileId,
          ]);
        if (lockedProfiles.length === 0) {
          throw new BarberProfileNotFoundError(input.barberProfileId);
        }

        const barber = await context.barberProfileRepository.findById(
          input.barberProfileId,
        );
        if (
          !barber ||
          !barber.displayName ||
          barber.displayName.trim().length === 0
        ) {
          throw new BarberNotAvailableForBookingError(input.barberProfileId);
        }

        const isEligible = await context.barberEligibilityRepository.isEligible(
          input.barberProfileId,
          input.serviceId,
        );
        if (!isEligible) {
          throw new BarberNotEligibleError(
            input.barberProfileId,
            input.serviceId,
          );
        }

        const schedules =
          await context.scheduleRepository.getBarberSchedulesForDay(
            input.barberProfileId,
            dayOfWeek,
          );
        const shiftCovers = schedules.some((s) => {
          const shiftStart = parseJakartaWallClockInstant(
            targetDateJakarta,
            s.startTime,
          );
          const shiftEnd = parseJakartaWallClockInstant(
            targetDateJakarta,
            s.endTime,
          );
          return shiftStart <= input.startsAt && shiftEnd >= endsAt;
        });

        if (!shiftCovers) {
          throw new BarberNotWorkingError(input.barberProfileId);
        }

        const exceptions =
          await context.scheduleRepository.getScheduleExceptions({
            barberProfileId: input.barberProfileId,
            start: input.startsAt,
            end: endsAt,
          });
        if (exceptions.length > 0) {
          throw new ScheduleExceptionConflictError(exceptions[0]!.reason);
        }

        const activeAppts =
          await context.appointmentRepository.findActiveByBarberAndInterval(
            input.barberProfileId,
            appointmentInterval,
          );
        if (activeAppts.length > 0) {
          throw new SlotAlreadyBookedError(
            input.barberProfileId,
            appointmentInterval,
          );
        }

        assignedBarberProfileId = input.barberProfileId;
        isAutoAssigned = false;
      } else {
        // ANY_AVAILABLE Mode
        const eligibleBarberIds =
          await context.barberEligibilityRepository.findEligibleBarberProfileIds(
            input.serviceId,
          );
        if (eligibleBarberIds.length === 0) {
          throw new SlotAlreadyBookedError(undefined, appointmentInterval);
        }

        // Lock candidate barber rows in deterministic ascending ID order using FOR UPDATE
        const lockedBarberIds =
          await context.barberProfileRepository.lockProfiles(eligibleBarberIds);
        if (lockedBarberIds.length === 0) {
          throw new SlotAlreadyBookedError(undefined, appointmentInterval);
        }

        // Re-evaluate availability AFTER acquiring locks
        const availableBarberIds: string[] = [];

        for (const barberId of lockedBarberIds) {
          const barber =
            await context.barberProfileRepository.findById(barberId);
          if (
            !barber ||
            !barber.displayName ||
            barber.displayName.trim().length === 0
          ) {
            continue;
          }

          const schedules =
            await context.scheduleRepository.getBarberSchedulesForDay(
              barberId,
              dayOfWeek,
            );
          const shiftCovers = schedules.some((s) => {
            const shiftStart = parseJakartaWallClockInstant(
              targetDateJakarta,
              s.startTime,
            );
            const shiftEnd = parseJakartaWallClockInstant(
              targetDateJakarta,
              s.endTime,
            );
            return shiftStart <= input.startsAt && shiftEnd >= endsAt;
          });
          if (!shiftCovers) continue;

          const exceptions =
            await context.scheduleRepository.getScheduleExceptions({
              barberProfileId: barberId,
              start: input.startsAt,
              end: endsAt,
            });
          if (exceptions.length > 0) continue;

          const activeAppts =
            await context.appointmentRepository.findActiveByBarberAndInterval(
              barberId,
              appointmentInterval,
            );
          if (activeAppts.length > 0) continue;

          availableBarberIds.push(barberId);
        }

        if (availableBarberIds.length === 0) {
          throw new SlotAlreadyBookedError(undefined, appointmentInterval);
        }

        if (availableBarberIds.length === 1) {
          assignedBarberProfileId = availableBarberIds[0]!;
        } else {
          const { dayStart, nextDayStart } =
            getJakartaDayBoundaries(targetDateJakarta);
          const workloads =
            await context.appointmentRepository.getBarberDailyWorkloads(
              availableBarberIds,
              dayStart,
              nextDayStart,
            );
          assignedBarberProfileId = FairnessSelector.selectBarber(workloads);
        }

        isAutoAssigned = true;
      }

      // Step F: Create confirmed appointment with SAVEPOINT retry on booking_reference collision
      const appointment =
        await context.appointmentRepository.createConfirmedAppointmentWithRetry(
          {
            customerId: input.customerId,
            barberProfileId: assignedBarberProfileId,
            serviceId: input.serviceId,
            status: AppointmentStatus.CONFIRMED,
            startsAt: input.startsAt,
            endsAt,
            serviceDurationMinutes,
            priceRupiah,
            notes: input.notes ?? null,
            isAutoAssigned,
          },
          () => this.referenceGenerator.generate(input.startsAt),
        );

      // Step G: If idempotencyKey is present, persist idempotency record in the same transaction
      if (input.idempotencyKey && requestHash) {
        await context.idempotencyRepository.createRecord({
          actorId: input.actorId,
          operation: CONFIRM_BOOKING_OPERATION,
          idempotencyKey: input.idempotencyKey,
          requestHash,
          appointmentId: appointment.id,
        });
      }

      return {
        appointment,
        isIdempotentReplay: false,
      };
    });
  }
}
