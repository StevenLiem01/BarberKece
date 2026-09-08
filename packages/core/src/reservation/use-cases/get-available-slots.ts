import { Clock, SystemClock } from "../ports/clock.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import { BarberEligibilityRepository } from "../ports/barber-eligibility-repository.js";
import { ScheduleRepository } from "../ports/schedule-repository.js";
import { AppointmentRepository } from "../ports/appointment-repository.js";
import { TimeInterval } from "../domain/time-interval.js";
import { AvailabilityCalculator } from "../domain/availability-calculator.js";
import {
  getJakartaCalendarDateString,
  getJakartaDayBoundaries,
  getJakartaDayOfWeek,
  isValidCalendarDateString,
  addCalendarDaysToDateString,
} from "../domain/date-utils.js";
import {
  BarberNotEligibleError,
  BookingHorizonExceededError,
  InactiveServiceError,
  InvalidBookingDateError,
  InvalidBookingHorizonConfigError,
  ServiceNotFoundError,
} from "../errors.js";
import { BarberProfileNotFoundError } from "../../barber/errors.js";

export class AvailabilityConfig {
  readonly bookingHorizonDays: number;

  constructor(bookingHorizonDays = 30) {
    if (
      !Number.isInteger(bookingHorizonDays) ||
      bookingHorizonDays < 7 ||
      bookingHorizonDays > 90
    ) {
      throw new InvalidBookingHorizonConfigError(bookingHorizonDays);
    }
    this.bookingHorizonDays = bookingHorizonDays;
  }
}

export interface GetAvailableSlotsInput {
  serviceId: string;
  date: string; // YYYY-MM-DD
  barberProfileId?: string | null;
}

export interface AvailableSlotDto {
  startsAt: Date;
  endsAt: Date;
}

export interface GetAvailableSlotsResult {
  date: string;
  slots: AvailableSlotDto[];
}

export class GetAvailableSlotsUseCase {
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private readonly barberProfileRepository: BarberProfileRepository,
    private readonly barberEligibilityRepository: BarberEligibilityRepository,
    private readonly scheduleRepository: ScheduleRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly clock: Clock = new SystemClock(),
    private readonly config: AvailabilityConfig = new AvailabilityConfig(),
  ) {}

  async execute(
    input: GetAvailableSlotsInput,
  ): Promise<GetAvailableSlotsResult> {
    const now = this.clock.now();

    if (!input.date || !isValidCalendarDateString(input.date)) {
      throw new InvalidBookingDateError(
        `Invalid date format: ${input.date}. Expected YYYY-MM-DD.`,
      );
    }

    const todayStr = getJakartaCalendarDateString(now);
    if (input.date < todayStr) {
      throw new InvalidBookingDateError(
        `Booking date cannot be in the past: ${input.date} is before ${todayStr}`,
      );
    }

    const maxDateStr = addCalendarDaysToDateString(
      todayStr,
      this.config.bookingHorizonDays,
    );
    if (input.date > maxDateStr) {
      throw new BookingHorizonExceededError(input.date, maxDateStr);
    }

    const service = await this.serviceRepository.findById(input.serviceId);
    if (!service) {
      throw new ServiceNotFoundError(input.serviceId);
    }
    if (!service.isActive) {
      throw new InactiveServiceError(input.serviceId);
    }

    let candidateBarberIds: string[];

    if (input.barberProfileId) {
      const barber = await this.barberProfileRepository.findById(
        input.barberProfileId,
      );
      if (!barber) {
        throw new BarberProfileNotFoundError(input.barberProfileId);
      }

      const isEligible = await this.barberEligibilityRepository.isEligible(
        barber.id,
        service.id,
      );
      if (!isEligible) {
        throw new BarberNotEligibleError(barber.id, service.id);
      }

      candidateBarberIds = [barber.id];
    } else {
      candidateBarberIds =
        await this.barberEligibilityRepository.findEligibleBarberProfileIds(
          service.id,
        );
      if (candidateBarberIds.length === 0) {
        return { date: input.date, slots: [] };
      }
    }

    const dayBoundaries = getJakartaDayBoundaries(input.date);
    const dayOfWeek = getJakartaDayOfWeek(input.date);

    const businessHours =
      await this.scheduleRepository.getBusinessHoursForDay(dayOfWeek);
    if (!businessHours || businessHours.isClosed) {
      return { date: input.date, slots: [] };
    }

    const allSlotsMap = new Map<number, AvailableSlotDto>();
    const dayInterval = new TimeInterval(
      dayBoundaries.dayStart,
      dayBoundaries.nextDayStart,
    );

    for (const barberId of candidateBarberIds) {
      const [barberSchedules, scheduleExceptions, activeAppointments] =
        await Promise.all([
          this.scheduleRepository.getBarberSchedulesForDay(barberId, dayOfWeek),
          this.scheduleRepository.getScheduleExceptions({
            barberProfileId: barberId,
            start: dayBoundaries.dayStart,
            end: dayBoundaries.nextDayStart,
          }),
          this.appointmentRepository.findActiveByBarberAndInterval(
            barberId,
            dayInterval,
          ),
        ]);

      const barberSlots = AvailabilityCalculator.calculateBarberSlots({
        dateStr: input.date,
        serviceDurationMinutes: service.durationMinutes,
        businessHours,
        barberSchedules,
        scheduleExceptions,
        activeAppointments,
        now,
      });

      for (const slot of barberSlots) {
        const timeKey = slot.startsAt.getTime();
        if (!allSlotsMap.has(timeKey)) {
          allSlotsMap.set(timeKey, slot);
        }
      }
    }

    const sortedSlots = Array.from(allSlotsMap.values()).sort(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
    );

    return {
      date: input.date,
      slots: sortedSlots,
    };
  }
}
