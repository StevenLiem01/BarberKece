import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { createDatabase, DatabaseClient } from "../../../client.js";
import { PostgresScheduleRepository } from "../postgres-schedule-repository.js";
import { businessHours } from "../../../schema/reservation/business_hours.js";
import { barberSchedules } from "../../../schema/reservation/barber_schedules.js";
import { scheduleExceptions } from "../../../schema/reservation/schedule_exceptions.js";
import { barberProfiles } from "../../../schema/barber/barber_profiles.js";
import { users } from "../../../schema/identity/users.js";

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const candidatePaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
];

for (const envPath of candidatePaths) {
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      if (process.env["DATABASE_URL"]) {
        break;
      }
    } catch {
      // Ignore
    }
  }
}

const TEST_DB_URL =
  process.env["DATABASE_URL"] ||
  "postgres://barberkece_dev:devpassword@localhost:5432/barberkece_dev";

describe("PostgresScheduleRepository", () => {
  let dbClient: DatabaseClient;
  let repository: PostgresScheduleRepository;

  const testUserIds: string[] = [];
  const testBarberIds: string[] = [];
  const testScheduleIds: string[] = [];
  const testExceptionIds: string[] = [];
  const testDaysOfWeek: number[] = [1, 2];

  let barberId: string;

  beforeAll(async () => {
    dbClient = createDatabase(TEST_DB_URL);
    repository = new PostgresScheduleRepository(dbClient.db);

    const barberUser = uuidv7();
    testUserIds.push(barberUser);
    await dbClient.db.insert(users).values({
      id: barberUser,
      email: `sched-barber-${barberUser}@test.com`,
      passwordHash: "dummyhash",
      role: "BARBER",
      status: "ACTIVE",
    });

    barberId = uuidv7();
    testBarberIds.push(barberId);
    await dbClient.db.insert(barberProfiles).values({
      id: barberId,
      userId: barberUser,
      specialization: "General Cuts",
    });
  });

  afterAll(async () => {
    if (testExceptionIds.length > 0) {
      await dbClient.db
        .delete(scheduleExceptions)
        .where(inArray(scheduleExceptions.id, testExceptionIds));
    }
    if (testScheduleIds.length > 0) {
      await dbClient.db
        .delete(barberSchedules)
        .where(inArray(barberSchedules.id, testScheduleIds));
    }
    if (testDaysOfWeek.length > 0) {
      await dbClient.db
        .delete(businessHours)
        .where(inArray(businessHours.dayOfWeek, testDaysOfWeek));
    }
    if (testBarberIds.length > 0) {
      await dbClient.db
        .delete(barberProfiles)
        .where(inArray(barberProfiles.id, testBarberIds));
    }
    if (testUserIds.length > 0) {
      await dbClient.db.delete(users).where(inArray(users.id, testUserIds));
    }
    await dbClient.close();
  });

  it("upserts and retrieves business hours", async () => {
    const monday = await repository.upsertBusinessHours({
      dayOfWeek: 1,
      openTime: "09:00:00",
      closeTime: "18:00:00",
      isClosed: false,
    });

    expect(monday.dayOfWeek).toBe(1);
    expect(monday.openTime).toBe("09:00:00");
    expect(monday.closeTime).toBe("18:00:00");
    expect(monday.isClosed).toBe(false);

    // Update existing
    const updated = await repository.upsertBusinessHours({
      dayOfWeek: 1,
      openTime: "09:30:00",
      closeTime: "18:30:00",
      isClosed: false,
    });

    expect(updated.openTime).toBe("09:30:00");

    const fetched = await repository.getBusinessHoursForDay(1);
    expect(fetched?.openTime).toBe("09:30:00");
  });

  it("creates and retrieves barber working shifts", async () => {
    const shift1 = await repository.createBarberSchedule({
      barberProfileId: barberId,
      dayOfWeek: 1,
      startTime: "09:00:00",
      endTime: "12:00:00",
    });
    testScheduleIds.push(shift1.id);

    const shift2 = await repository.createBarberSchedule({
      barberProfileId: barberId,
      dayOfWeek: 1,
      startTime: "13:00:00",
      endTime: "18:00:00",
    });
    testScheduleIds.push(shift2.id);

    const shifts = await repository.getBarberSchedulesForDay(barberId, 1);
    expect(shifts.length).toBe(2);
    expect(shifts[0]!.startTime).toBe("09:00:00");
    expect(shifts[1]!.startTime).toBe("13:00:00");
  });

  it("creates and retrieves schedule exceptions (shop-wide and barber-specific)", async () => {
    // Shop-wide holiday (barberProfileId: null)
    const holiday = await repository.createScheduleException({
      barberProfileId: null,
      reason: "National Holiday",
      startsAt: new Date("2026-10-05T00:00:00.000Z"),
      endsAt: new Date("2026-10-05T23:59:59.999Z"),
    });
    testExceptionIds.push(holiday.id);

    // Barber-specific leave
    const leave = await repository.createScheduleException({
      barberProfileId: barberId,
      reason: "Doctor Appointment",
      startsAt: new Date("2026-10-06T10:00:00.000Z"),
      endsAt: new Date("2026-10-06T12:00:00.000Z"),
    });
    testExceptionIds.push(leave.id);

    // Query for barber on Oct 5: should return the shop-wide holiday
    const oct5Exceptions = await repository.getScheduleExceptions({
      barberProfileId: barberId,
      start: new Date("2026-10-05T09:00:00.000Z"),
      end: new Date("2026-10-05T17:00:00.000Z"),
    });
    expect(oct5Exceptions.length).toBe(1);
    expect(oct5Exceptions[0]!.reason).toBe("National Holiday");

    // Query for barber on Oct 6: should return the barber leave
    const oct6Exceptions = await repository.getScheduleExceptions({
      barberProfileId: barberId,
      start: new Date("2026-10-06T09:00:00.000Z"),
      end: new Date("2026-10-06T17:00:00.000Z"),
    });
    expect(oct6Exceptions.length).toBe(1);
    expect(oct6Exceptions[0]!.reason).toBe("Doctor Appointment");
  });
});
