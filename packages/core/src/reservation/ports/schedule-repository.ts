import type { BusinessHours } from "../models/business-hours.js";
import type { BarberSchedule } from "../models/barber-schedule.js";
import type { ScheduleException } from "../models/schedule-exception.js";

export interface UpsertBusinessHoursParams {
  id?: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
}

export interface CreateBarberScheduleParams {
  id?: string;
  barberProfileId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

export interface CreateScheduleExceptionParams {
  id?: string;
  barberProfileId?: string | null;
  reason: string;
  startsAt: Date;
  endsAt: Date;
}

export interface ScheduleRepository {
  getBusinessHours(): Promise<BusinessHours[]>;
  getBusinessHoursForDay(dayOfWeek: number): Promise<BusinessHours | null>;
  upsertBusinessHours(
    params: UpsertBusinessHoursParams,
  ): Promise<BusinessHours>;

  getBarberSchedules(barberProfileId: string): Promise<BarberSchedule[]>;
  getBarberSchedulesForDay(
    barberProfileId: string,
    dayOfWeek: number,
  ): Promise<BarberSchedule[]>;
  createBarberSchedule(
    params: CreateBarberScheduleParams,
  ): Promise<BarberSchedule>;

  getScheduleExceptions(params: {
    barberProfileId?: string | null;
    start: Date;
    end: Date;
  }): Promise<ScheduleException[]>;
  createScheduleException(
    params: CreateScheduleExceptionParams,
  ): Promise<ScheduleException>;
}
