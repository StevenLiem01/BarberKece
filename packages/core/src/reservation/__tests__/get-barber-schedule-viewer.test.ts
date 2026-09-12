import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { GetBarberScheduleViewer } from "../use-cases/get-barber-schedule-viewer.js";
import type { ScheduleRepository } from "../ports/schedule-repository.js";
import { BarberSchedule } from "../models/barber-schedule.js";
import { ScheduleException } from "../models/schedule-exception.js";
import { randomUUID } from "node:crypto";

describe("GetBarberScheduleViewer", () => {
  let scheduleRepository: Mocked<ScheduleRepository>;
  let useCase: GetBarberScheduleViewer;

  beforeEach(() => {
    scheduleRepository = {
      getBarberSchedules: vi.fn(),
      getScheduleExceptions: vi.fn(),
      getBusinessHours: vi.fn(),
      getBusinessHoursForDay: vi.fn(),
      upsertBusinessHours: vi.fn(),
      getBarberSchedulesForDay: vi.fn(),
      createBarberSchedule: vi.fn(),
      createScheduleException: vi.fn(),
    } as unknown as Mocked<ScheduleRepository>;

    useCase = new GetBarberScheduleViewer(scheduleRepository);
  });

  it("should retrieve schedules and exceptions for the viewer", async () => {
    const barberProfileId = randomUUID();
    const horizonEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const mockSchedule: BarberSchedule = {
      id: randomUUID(),
      barberProfileId,
      dayOfWeek: 1, // Monday
      startTime: "09:00",
      endTime: "17:00",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockException: ScheduleException = {
      id: randomUUID(),
      barberProfileId,
      reason: "Sick Leave",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    scheduleRepository.getBarberSchedules.mockResolvedValue([mockSchedule]);
    scheduleRepository.getScheduleExceptions.mockResolvedValue([mockException]);

    const result = await useCase.execute({
      barberProfileId,
      horizonEnd,
    });

    // Check schedules
    expect(scheduleRepository.getBarberSchedules).toHaveBeenCalledWith(
      barberProfileId,
    );
    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0]).toEqual(mockSchedule);

    // Check exceptions
    expect(scheduleRepository.getScheduleExceptions).toHaveBeenCalledWith(
      expect.objectContaining({
        barberProfileId,
        end: horizonEnd,
      }),
    );
    expect(result.exceptions).toHaveLength(1);
    expect(result.exceptions[0]).toEqual(mockException);
  });

  it("should return empty arrays if none exist", async () => {
    scheduleRepository.getBarberSchedules.mockResolvedValue([]);
    scheduleRepository.getScheduleExceptions.mockResolvedValue([]);

    const result = await useCase.execute({
      barberProfileId: randomUUID(),
      horizonEnd: new Date(),
    });

    expect(result.schedules).toEqual([]);
    expect(result.exceptions).toEqual([]);
  });
});
