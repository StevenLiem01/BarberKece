import { BusinessHours } from "../models/business-hours.js";
import { BarberSchedule } from "../models/barber-schedule.js";
import { ScheduleException } from "../models/schedule-exception.js";
import { Appointment } from "../models/appointment.js";
import {
  ceilToQuarterHourBoundary,
  parseJakartaWallClockInstant,
} from "./date-utils.js";

export interface CalculateBarberAvailabilityParams {
  dateStr: string;
  serviceDurationMinutes: number;
  businessHours: BusinessHours | null;
  barberSchedules: BarberSchedule[];
  scheduleExceptions: ScheduleException[];
  activeAppointments: Appointment[];
  now: Date;
}

export interface AvailableSlot {
  startsAt: Date;
  endsAt: Date;
}

export class AvailabilityCalculator {
  /**
   * Pure deterministic calculation of available slots for a single barber.
   * Performs zero I/O.
   */
  static calculateBarberSlots(
    params: CalculateBarberAvailabilityParams,
  ): AvailableSlot[] {
    const {
      dateStr,
      serviceDurationMinutes,
      businessHours,
      barberSchedules,
      scheduleExceptions,
      activeAppointments,
      now,
    } = params;

    // If shop has no business hours configured or is marked closed
    if (!businessHours || businessHours.isClosed) {
      return [];
    }

    if (serviceDurationMinutes <= 0) {
      return [];
    }

    const shopOpen = parseJakartaWallClockInstant(
      dateStr,
      businessHours.openTime,
    );
    const shopClose = parseJakartaWallClockInstant(
      dateStr,
      businessHours.closeTime,
    );

    if (shopClose.getTime() <= shopOpen.getTime()) {
      return [];
    }

    const serviceDurationMs = serviceDurationMinutes * 60 * 1000;
    const QUARTER_HOUR_MS = 15 * 60 * 1000;

    // Combine all blocking intervals (exceptions and active appointments)
    const blockingIntervals: Array<{ start: number; end: number }> = [];

    for (const exception of scheduleExceptions) {
      blockingIntervals.push({
        start: exception.startsAt.getTime(),
        end: exception.endsAt.getTime(),
      });
    }

    for (const appt of activeAppointments) {
      blockingIntervals.push({
        start: appt.startsAt.getTime(),
        end: appt.endsAt.getTime(),
      });
    }

    const slots: AvailableSlot[] = [];

    // For each working shift of the barber
    for (const schedule of barberSchedules) {
      const shiftStart = parseJakartaWallClockInstant(
        dateStr,
        schedule.startTime,
      );
      const shiftEnd = parseJakartaWallClockInstant(dateStr, schedule.endTime);

      if (shiftEnd.getTime() <= shiftStart.getTime()) {
        continue;
      }

      // Intersection of barber shift with shop open hours
      const windowStartMs = Math.max(shiftStart.getTime(), shopOpen.getTime());
      const windowEndMs = Math.min(shiftEnd.getTime(), shopClose.getTime());

      if (windowEndMs <= windowStartMs) {
        continue;
      }

      // Continuous window must fit the entire service duration
      if (windowEndMs - windowStartMs < serviceDurationMs) {
        continue;
      }

      // Earliest allowable start is strictly in the future relative to now (startsAt > now)
      // and within the continuous shift window.
      const earliestStartMs = Math.max(windowStartMs, now.getTime() + 1);
      const alignedStart = ceilToQuarterHourBoundary(new Date(earliestStartMs));
      let candidateStartMs = alignedStart.getTime();

      // Defensive invariant: candidate start must be strictly greater than now
      while (candidateStartMs <= now.getTime()) {
        candidateStartMs += QUARTER_HOUR_MS;
      }

      while (candidateStartMs + serviceDurationMs <= windowEndMs) {
        const candidateEndMs = candidateStartMs + serviceDurationMs;

        // Check whether [candidateStartMs, candidateEndMs) overlaps any blocking interval
        // Overlap: A.start < B.end AND A.end > B.start
        let hasConflict = false;
        for (const block of blockingIntervals) {
          if (candidateStartMs < block.end && candidateEndMs > block.start) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          slots.push({
            startsAt: new Date(candidateStartMs),
            endsAt: new Date(candidateEndMs),
          });
        }

        candidateStartMs += QUARTER_HOUR_MS;
      }
    }

    return slots;
  }
}
