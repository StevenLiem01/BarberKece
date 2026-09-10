import type { Clock } from "../ports/clock.js";
import type { BookingTransactionRunner } from "../ports/booking-transaction-runner.js";
import { AppointmentStatus } from "../domain/appointment-status.js";
import type { Appointment } from "../models/appointment.js";
import {
  addCalendarDaysToDateString,
  getJakartaCalendarDateString,
  getJakartaDayOfWeek,
  parseJakartaWallClockInstant,
} from "../domain/date-utils.js";
import { TimeInterval } from "../domain/time-interval.js";
import {
  AppointmentNotFoundError,
  AppointmentOwnershipError,
  BarberNotWorkingError,
  BookingHorizonExceededError,
  CustomerBookingConflictError,
  InvalidAppointmentStatusTransitionError,
  InvalidBookingDateError,
  InvalidBookingHorizonConfigError,
  OutsideBusinessHoursError,
  RescheduleCutoffExceededError,
  ScheduleExceptionConflictError,
  SlotAlreadyBookedError,
} from "../errors.js";
import { BarberProfileNotFoundError } from "../../barber/errors.js";

const DEFAULT_BOOKING_HORIZON_DAYS = 30;
const MIN_BOOKING_HORIZON_DAYS = 7;
const MAX_BOOKING_HORIZON_DAYS = 90;
const QUARTER_HOUR_MS = 15 * 60 * 1000;
const DEFAULT_RESCHEDULE_CUTOFF_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface RescheduleAppointmentInput {
  actorId: string;
  appointmentId: string;
  newStartsAt: Date;
}

export interface RescheduleAppointmentOutput {
  appointment: Appointment;
}

export class RescheduleAppointmentUseCase {
  private readonly bookingHorizonDays: number;

  constructor(
    private readonly transactionRunner: BookingTransactionRunner,
    private readonly clock: Clock,
    options?: {
      bookingHorizonDays?: number;
    },
  ) {
    const horizon = options?.bookingHorizonDays ?? DEFAULT_BOOKING_HORIZON_DAYS;
    if (
      horizon < MIN_BOOKING_HORIZON_DAYS ||
      horizon > MAX_BOOKING_HORIZON_DAYS
    ) {
      throw new InvalidBookingHorizonConfigError(horizon);
    }
    this.bookingHorizonDays = horizon;
  }

  async execute(
    input: RescheduleAppointmentInput,
  ): Promise<RescheduleAppointmentOutput> {
    // Freeze clock once per execution
    const now = this.clock.now();

    // 1. newStartsAt must be strictly in the future
    if (input.newStartsAt.getTime() <= now.getTime()) {
      throw new InvalidBookingDateError(
        "Appointment start time must be in the future",
      );
    }

    // 2. newStartsAt must lie exactly on the 15-minute grid (:00, :15, :30, :45)
    if (input.newStartsAt.getTime() % QUARTER_HOUR_MS !== 0) {
      throw new InvalidBookingDateError(
        "Appointment start time must be on a 15-minute boundary (:00, :15, :30, :45)",
      );
    }

    // 3. Validate booking horizon using Asia/Jakarta date utilities
    const todayJakarta = getJakartaCalendarDateString(now);
    const targetDateJakarta = getJakartaCalendarDateString(input.newStartsAt);

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

    return await this.transactionRunner.run(async (context) => {
      // Step A: Lock target appointment
      const appointment = await context.appointmentRepository.lockAppointment(
        input.appointmentId,
      );
      if (!appointment) {
        throw new AppointmentNotFoundError(input.appointmentId);
      }

      // Step B: Ownership check (Customer must own the appointment)
      if (appointment.customerId !== input.actorId) {
        throw new AppointmentOwnershipError(input.appointmentId, input.actorId);
      }

      // Step C: Status check (Only CONFIRMED appointments can be rescheduled)
      if (appointment.status !== AppointmentStatus.CONFIRMED) {
        throw new InvalidAppointmentStatusTransitionError(
          appointment.status,
          AppointmentStatus.CONFIRMED,
        );
      }

      // Step D: Cutoff check on current appointment (>= 2 hours before current startsAt)
      const timeUntilStart = appointment.startsAt.getTime() - now.getTime();
      if (timeUntilStart < DEFAULT_RESCHEDULE_CUTOFF_MS) {
        throw new RescheduleCutoffExceededError(appointment.startsAt);
      }

      // Step E: Reject no-op reschedule (same start time)
      if (input.newStartsAt.getTime() === appointment.startsAt.getTime()) {
        throw new InvalidBookingDateError(
          "New appointment time must be different from current time",
        );
      }

      // Step F: Server-derived newEndsAt from existing serviceDurationMinutes snapshot
      const newEndsAt = new Date(
        input.newStartsAt.getTime() +
          appointment.serviceDurationMinutes * 60 * 1000,
      );
      const newInterval = new TimeInterval(input.newStartsAt, newEndsAt);

      // Step G: Revalidate business hours for target date and interval
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

      if (input.newStartsAt < shopOpen || newEndsAt > shopClose) {
        throw new OutsideBusinessHoursError(
          "Appointment interval must fall entirely within business hours",
        );
      }

      // Step H: Lock assigned barber row
      const lockedProfiles = await context.barberProfileRepository.lockProfiles(
        [appointment.barberProfileId],
      );
      if (lockedProfiles.length === 0) {
        throw new BarberProfileNotFoundError(appointment.barberProfileId);
      }

      // Step I: Validate assigned barber's working shift covers new interval
      const schedules =
        await context.scheduleRepository.getBarberSchedulesForDay(
          appointment.barberProfileId,
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
        return shiftStart <= input.newStartsAt && shiftEnd >= newEndsAt;
      });

      if (!shiftCovers) {
        throw new BarberNotWorkingError(appointment.barberProfileId);
      }

      // Step J: Validate no schedule exceptions for assigned barber
      const exceptions = await context.scheduleRepository.getScheduleExceptions(
        {
          barberProfileId: appointment.barberProfileId,
          start: input.newStartsAt,
          end: newEndsAt,
        },
      );
      if (exceptions.length > 0) {
        throw new ScheduleExceptionConflictError(exceptions[0]!.reason);
      }

      // Step K: Check barber active appointments, excluding this appointment
      const barberOverlap =
        await context.appointmentRepository.findActiveByBarberAndIntervalExcluding(
          appointment.barberProfileId,
          newInterval,
          appointment.id,
        );
      if (barberOverlap.length > 0) {
        throw new SlotAlreadyBookedError(
          appointment.barberProfileId,
          newInterval,
        );
      }

      // Step L: Check customer active appointments, excluding this appointment
      const customerOverlap =
        await context.appointmentRepository.findActiveByCustomerAndIntervalExcluding(
          appointment.customerId,
          newInterval,
          appointment.id,
        );
      if (customerOverlap.length > 0) {
        throw new CustomerBookingConflictError(
          appointment.customerId,
          newInterval,
        );
      }

      // Step M: Atomically update appointment to new interval
      const updated = await context.appointmentRepository.rescheduleAppointment(
        appointment.id,
        input.newStartsAt,
        newEndsAt,
      );

      return {
        appointment: updated,
      };
    });
  }
}
