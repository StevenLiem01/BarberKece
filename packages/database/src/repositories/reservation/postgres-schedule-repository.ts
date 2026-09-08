import { and, eq, gt, lt, or, isNull } from "drizzle-orm";
import type { DbOrTx } from "../../client.js";
import { businessHours } from "../../schema/reservation/business_hours.js";
import { barberSchedules } from "../../schema/reservation/barber_schedules.js";
import { scheduleExceptions } from "../../schema/reservation/schedule_exceptions.js";
import {
  BarberSchedule,
  BusinessHours,
  CreateBarberScheduleParams,
  CreateScheduleExceptionParams,
  ScheduleException,
  ScheduleRepository,
  UpsertBusinessHoursParams,
} from "@barberkece/core/reservation";

export class PostgresScheduleRepository implements ScheduleRepository {
  constructor(private readonly db: DbOrTx) {}

  async getBusinessHours(): Promise<BusinessHours[]> {
    return this.db
      .select()
      .from(businessHours)
      .orderBy(businessHours.dayOfWeek);
  }

  async getBusinessHoursForDay(
    dayOfWeek: number,
  ): Promise<BusinessHours | null> {
    const [found] = await this.db
      .select()
      .from(businessHours)
      .where(eq(businessHours.dayOfWeek, dayOfWeek))
      .limit(1);

    return found ?? null;
  }

  async upsertBusinessHours(
    params: UpsertBusinessHoursParams,
  ): Promise<BusinessHours> {
    const [result] = await this.db
      .insert(businessHours)
      .values({
        id: params.id,
        dayOfWeek: params.dayOfWeek,
        openTime: params.openTime,
        closeTime: params.closeTime,
        isClosed: params.isClosed ?? false,
      })
      .onConflictDoUpdate({
        target: businessHours.dayOfWeek,
        set: {
          openTime: params.openTime,
          closeTime: params.closeTime,
          isClosed: params.isClosed ?? false,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!result) {
      throw new Error("Failed to upsert business hours");
    }

    return result;
  }

  async getBarberSchedules(barberProfileId: string): Promise<BarberSchedule[]> {
    return this.db
      .select()
      .from(barberSchedules)
      .where(
        and(
          eq(barberSchedules.barberProfileId, barberProfileId),
          eq(barberSchedules.isActive, true),
        ),
      )
      .orderBy(barberSchedules.dayOfWeek, barberSchedules.startTime);
  }

  async getBarberSchedulesForDay(
    barberProfileId: string,
    dayOfWeek: number,
  ): Promise<BarberSchedule[]> {
    return this.db
      .select()
      .from(barberSchedules)
      .where(
        and(
          eq(barberSchedules.barberProfileId, barberProfileId),
          eq(barberSchedules.dayOfWeek, dayOfWeek),
          eq(barberSchedules.isActive, true),
        ),
      )
      .orderBy(barberSchedules.startTime);
  }

  async createBarberSchedule(
    params: CreateBarberScheduleParams,
  ): Promise<BarberSchedule> {
    const [inserted] = await this.db
      .insert(barberSchedules)
      .values({
        id: params.id,
        barberProfileId: params.barberProfileId,
        dayOfWeek: params.dayOfWeek,
        startTime: params.startTime,
        endTime: params.endTime,
        isActive: params.isActive ?? true,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert barber schedule");
    }

    return inserted;
  }

  async getScheduleExceptions(params: {
    barberProfileId?: string | null;
    start: Date;
    end: Date;
  }): Promise<ScheduleException[]> {
    const barberCondition =
      params.barberProfileId !== undefined
        ? params.barberProfileId === null
          ? isNull(scheduleExceptions.barberProfileId)
          : or(
              isNull(scheduleExceptions.barberProfileId),
              eq(scheduleExceptions.barberProfileId, params.barberProfileId),
            )
        : undefined;

    const timeCondition = and(
      lt(scheduleExceptions.startsAt, params.end),
      gt(scheduleExceptions.endsAt, params.start),
    );

    const whereClause = barberCondition
      ? and(barberCondition, timeCondition)
      : timeCondition;

    return this.db
      .select()
      .from(scheduleExceptions)
      .where(whereClause)
      .orderBy(scheduleExceptions.startsAt);
  }

  async createScheduleException(
    params: CreateScheduleExceptionParams,
  ): Promise<ScheduleException> {
    const [inserted] = await this.db
      .insert(scheduleExceptions)
      .values({
        id: params.id,
        barberProfileId: params.barberProfileId ?? null,
        reason: params.reason,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert schedule exception");
    }

    return inserted;
  }
}
